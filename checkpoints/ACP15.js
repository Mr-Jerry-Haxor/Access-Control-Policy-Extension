import { buildReviewPrompt, evidenceUnavailable, fail, getRoleRows, needsReview, normalizeText, pass, rowValues, skip, uniqueNormalized } from "./utils.js";

function canonicalEnvironment(value) {
    const text = normalizeText(value);
    if (/^(prod|production)$/.test(text)) return "production";
    if (/^(dev|development)$/.test(text)) return "development";
    if (/^(test|testing|qa|quality assurance)$/.test(text)) return "test";
    if (/^(dr|disaster recovery)$/.test(text)) return "disaster recovery";
    return text;
}

const ACP15 = {
    id: "ACP15",
    name: "CMDB server environments represented in roles",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP15",
        requirement: "Every server environment listed in CMDB is selected in at least one ACP-AR1 role.",
        targetQuestion: "ACP-AR1 Environment",
        correction: "the missing Environment selections by exact CMDB environment"
    }),
    async validate(context) {
        const servers = context.supportingData?.sisServers;
        if (evidenceUnavailable(servers)) return needsReview(this.id, "The CMDB/SIS server response is unavailable.");
        if (!Array.isArray(servers) || !servers.length) return skip(this.id, "CMDB/SIS lists no servers for the application.");
        const cmdb = uniqueNormalized(servers.map(server => server.environment)).map(canonicalEnvironment).filter(Boolean);
        if (!cmdb.length) return needsReview(this.id, "CMDB/SIS server records have no environment values.");
        const selected = new Set(getRoleRows(context).flatMap(row => rowValues(row, "environment")).map(canonicalEnvironment));
        const missing = cmdb.filter(environment => !selected.has(environment));
        return missing.length
            ? fail(this.id, `ACP-AR1 does not select CMDB server environment(s): ${missing.join(", ")}.`)
            : pass(this.id, `ACP-AR1 represents all CMDB server environments: ${cmdb.join(", ")}.`);
    }
};

export default ACP15;
