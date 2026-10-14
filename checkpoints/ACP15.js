import { buildReviewPrompt, evidenceUnavailable, fail, getRoleRows, needsReview, normalizeText, pass, rowValues, skip } from "./utils.js";

const CAIRO_ENVIRONMENTS = [
    "Business Unit Lab",
    "Cold Spare",
    "Development",
    "Disaster Recovery",
    "Install/Build",
    "Lab General",
    "Pre-production",
    "Production",
    "Test"
];

function canonicalEnvironments(value) {
    const text = normalizeText(value);
    if (!text) return [];
    const environments = new Set();
    const add = (environment, pattern, source = text) => {
        if (pattern.test(source)) environments.add(environment);
    };

    const businessUnitLab = /\b(business unit lab|bu lab)\b/;
    add("Business Unit Lab", businessUnitLab);
    add("Cold Spare", /\bcold spare\b/);
    add("Development", /\b(dev|development)\b/);
    add("Disaster Recovery", /\b(disaster recovery|dr)\b/);
    add("Install/Build", /\b(install build|installation|install|build)\b/);
    add("Lab General", /\b(lab general|general lab)\b/);
    if (!businessUnitLab.test(text) && !/\b(lab general|general lab)\b/.test(text)) {
        add("Lab General", /\blab\b/);
    }

    const preProduction = /\b(pre production|preproduction|pre prod|preprod|staging|stage|uat|user acceptance)\b/;
    if (preProduction.test(text)) environments.add("Pre-production");
    const productionCandidates = text
        .replace(/\b(pre production|preproduction|pre prod|preprod|staging|stage|uat|user acceptance)\b/g, " ")
        .replace(/\b(non production|non prod|nonprod)\b/g, " ");
    add("Production", /\b(prod|production)\b/, productionCandidates);
    add("Test", /\b(test|testing|qa|quality assurance)\b/);

    return CAIRO_ENVIRONMENTS.filter(environment => environments.has(environment));
}

const ACP15 = {
    id: "ACP15",
    name: "CMDB server environments represented in roles",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP15",
        requirement: "Every CMDB server environment that maps to a selectable CAIRO Environment is selected in at least one ACP-AR1 role; additional ACP environments are allowed.",
        targetQuestion: "ACP-AR1 Environment",
        correction: "the missing selectable CAIRO Environment values, with unmappable CMDB values identified for review"
    }),
    async validate(context) {
        const servers = context.supportingData?.sisServers;
        if (evidenceUnavailable(servers)) return needsReview(this.id, "The CMDB/SIS server response is unavailable.");
        if (!Array.isArray(servers) || !servers.length) return skip(this.id, "CMDB/SIS lists no servers for the application.");
        const cmdbValues = servers.flatMap(server => rowValues(server, "environment"));
        if (!cmdbValues.length) return needsReview(this.id, "CMDB/SIS server records have no environment values.");

        const cmdb = new Set();
        const unmapped = new Set();
        for (const value of cmdbValues) {
            const mapped = canonicalEnvironments(value);
            if (mapped.length) mapped.forEach(environment => cmdb.add(environment));
            else unmapped.add(String(value).trim());
        }

        const selected = new Set(
            getRoleRows(context)
                .flatMap(row => rowValues(row, "environment"))
                .flatMap(canonicalEnvironments)
        );
        const required = CAIRO_ENVIRONMENTS.filter(environment => cmdb.has(environment));
        const missing = required.filter(environment => !selected.has(environment));
        if (missing.length) {
            const reviewNote = unmapped.size
                ? ` Unmapped CMDB value(s) were not treated as missing selections: ${[...unmapped].join(", ")}.`
                : "";
            return fail(this.id, `ACP-AR1 does not select mapped CMDB server environment(s): ${missing.join(", ")}.${reviewNote}`);
        }
        if (unmapped.size) {
            return needsReview(this.id, `CMDB/SIS environment value(s) cannot be mapped to the available CAIRO options: ${[...unmapped].join(", ")}.`);
        }
        return pass(this.id, `ACP-AR1 represents all mapped CMDB server environments: ${required.join(", ")}. Additional ACP environments are allowed.`);
    }
};

export default ACP15;
