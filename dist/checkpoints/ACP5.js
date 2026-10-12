import {
    buildAiValidationPrompt,
    buildReviewPrompt,
    evidenceUnavailable,
    fail,
    formatRoleRowsForAi,
    getAdditionalInformation,
    hasRoleMatching,
    needsReview,
    pass,
    skip
} from "./utils.js";

const REQUIREMENT = "A non-cloud/non-container application with a CMDB database has a DBA role in ACP-AR1, unless ACP-AI2 clearly documents why the CMDB database association does not require an application-specific DBA role.";

const ACP5 = {
    id: "ACP5",
    name: "Database application has a DBA role",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP5",
        requirement: REQUIREMENT,
        targetQuestion: "ACP-AR1 and ACP-AI2",
        correction: "the missing DBA role fields, or a clear application-specific ACP-AI2 rationale"
    }),
    buildFailurePrompt(context) {
        return buildAiValidationPrompt({
            checkpointId: this.id,
            requirement: REQUIREMENT,
            decisionRules: "ACP-AR1 has no DBA role even though CMDB lists a database. Evaluate ACP-AI2 only for a documented exception. Return NA when ACP-AI2 clearly identifies the database relationship and explains why this application does not require its own DBA role, such as a shared database owned and administered under another application's ACP. Return FAIL when ACP-AI2 is blank, vague, unrelated, or does not explain where DBA responsibility is documented. Return REVIEW when the rationale is plausible but cannot be resolved from the supplied evidence. Do not return PASS because ACP-AR1 has no DBA role, and do not invent ownership or DBA responsibility.",
            evidence: {
                databases: context.supportingData?.gsepDatabases || [],
                accessRoles: formatRoleRowsForAi(context),
                additionalInformationQuestion: "ACP-AI2",
                additionalInformation: getAdditionalInformation(context)
            }
        });
    },
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
            : fail(this.id, `CMDB/GSEP lists ${databases.length} database record(s), but ACP-AR1 has no DBA role. ACP-AI2 requires AI verification.`);
    }
};

export default ACP5;
