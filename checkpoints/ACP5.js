import { buildReviewPrompt, evidenceUnavailable, fail, hasRoleMatching, needsReview, pass, skip } from "./utils.js";

const ACP5 = {
    id: "ACP5",
    name: "Database application has a DBA role",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP5",
        requirement: "A non-cloud/non-container application with a CMDB database has a DBA role in ACP-AR1.",
        targetQuestion: "ACP-AR1",
        correction: "the missing DBA role fields, or the evidenced N/A rationale"
    }),
    async validate(context) {
        const databases = context.supportingData?.gsepDatabases;
        if (evidenceUnavailable(databases)) return needsReview(this.id, "The CMDB/GSEP database response is unavailable.");
        if (!Array.isArray(databases) || databases.length === 0) return skip(this.id, "CMDB/GSEP lists no databases for the application.");
        const classification = JSON.stringify([
            context.supportingData?.esatsBusapp || [],
            context.supportingData?.assetLabels || []
        ]);
        if (/\b(cloud|container|saas|paas)\b/i.test(classification)) {
            return skip(this.id, "The application is explicitly identified as cloud/container hosted.");
        }
        return hasRoleMatching(context, /\bDBA\b|database administrator/i)
            ? pass(this.id, `CMDB/GSEP lists ${databases.length} database record(s), and ACP-AR1 contains a DBA role.`)
            : fail(this.id, `CMDB/GSEP lists ${databases.length} database record(s), but ACP-AR1 has no DBA role.`);
    }
};

export default ACP5;
