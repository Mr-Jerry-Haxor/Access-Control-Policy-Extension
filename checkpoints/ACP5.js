import { fail, getDatabaseApproverRows, hasRoleMatching, needsReview, pass } from "./utils.js";

const ACP5 = {
    id: "ACP5",
    name: "DBA Role Validation via CMDB",
    category: "Access Roles",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        const databaseApprovers = getDatabaseApproverRows(context);
        const hasDatabaseEvidence = databaseApprovers.length > 0 || hasRoleMatching(context, /\bDBA\b|database administrator/i);

        if (!hasDatabaseEvidence) {
            return needsReview(this.id, "No authoritative CMDB or CAIRO database evidence was available to establish DBA-role applicability.");
        }

        return hasRoleMatching(context, /\bDBA\b|database administrator/i)
            ? pass(this.id, "Database evidence exists and ACP-AR1 includes a DBA role.")
            : fail(this.id, "Database evidence exists, but ACP-AR1 does not include a DBA role.");
    }
};

export default ACP5;
