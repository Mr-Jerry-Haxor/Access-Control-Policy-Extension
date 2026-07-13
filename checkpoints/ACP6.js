import { getDatabaseApproverRows, needsReview } from "./utils.js";

const ACP6 = {
    id: "ACP6",
    name: "DBA Person Type Match via CMDB",
    category: "Access Roles",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        if (getDatabaseApproverRows(context).length === 0) {
            return needsReview(this.id, "No authoritative CMDB DBA inventory or ACP-RAP4 database approver evidence was found.");
        }
        return needsReview(this.id, "CAIRO exposed database approver identities, but authoritative CMDB DBA person-type evidence is unavailable.");
    }
};

export default ACP6;
