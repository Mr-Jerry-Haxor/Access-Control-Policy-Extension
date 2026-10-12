import { buildReviewPrompt, evidenceUnavailable, fail, getCedRecord, getRoleRows, needsReview, normalizeText, pass, rowValues, skip } from "./utils.js";

function collectDbaIds(databases) {
    const ids = new Set();
    const visit = value => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (value && typeof value === "object") return Object.values(value).forEach(visit);
        if (/^\d{3,}$/.test(String(value || "").trim())) ids.add(String(value).trim());
    };
    visit(databases.map(database => database.contactBemsIds));
    return [...ids];
}

function personType(record) {
    const text = normalizeText([record?.type, record?.relationships, record?.company].filter(Boolean).join(" "));
    if (/purchased services/.test(text)) return "Purchased Services";
    if (/non boeing|contract labor/.test(text)) return "Non-Boeing";
    if (/employee|boeing benefits|\bbps\b|the boeing company/.test(text)) return "Boeing Employee";
    return "";
}

const ACP6 = {
    id: "ACP6",
    name: "DBA person type matches CMDB DBA",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP6",
        requirement: "The DBA role Person Type matches at least one DBA associated with the application in CMDB/GSEP.",
        targetQuestion: "ACP-AR1",
        correction: "the evidenced DBA Person Type correction without exposing unnecessary identity details"
    }),
    async validate(context) {
        const databases = context.supportingData?.gsepDatabases;
        if (evidenceUnavailable(databases)) return needsReview(this.id, "The CMDB/GSEP database response is unavailable.");
        if (!Array.isArray(databases) || !databases.length) return skip(this.id, "CMDB/GSEP lists no databases for the application.");
        const dbaRows = getRoleRows(context).filter(row => /\bDBA\b|database administrator/i.test(rowValues(row, "role").join(" ")));
        if (!dbaRows.length) {
            const acp5Result = context.checkpointResults?.get?.("ACP5");
            if (acp5Result?.status === "N/A" && acp5Result.conditionalAiFallback === true) {
                return skip(this.id, "ACP5 is N/A because ACP-AI2 documents the accepted no-DBA-role exception.");
            }
            return fail(this.id, "No DBA role exists in ACP-AR1.");
        }
        const ids = collectDbaIds(databases);
        if (!ids.length) return needsReview(this.id, "CMDB/GSEP database records contain no DBA identity IDs.");
        const types = ids.map(id => personType(getCedRecord(context, id))).filter(Boolean);
        if (!types.length) return needsReview(this.id, "CED person-type evidence for the associated DBAs is unavailable.");
        const configured = dbaRows.flatMap(row => rowValues(row, "personType")).map(normalizeText);
        const matched = types.some(type => configured.some(value => value.includes(normalizeText(type)) || normalizeText(type).includes(value)));
        return matched
            ? pass(this.id, `ACP DBA Person Type matches CMDB/CED evidence (${[...new Set(types)].join(", ")}).`)
            : fail(this.id, `ACP DBA Person Type does not match CMDB/CED evidence (${[...new Set(types)].join(", ")}).`);
    }
};

export default ACP6;
