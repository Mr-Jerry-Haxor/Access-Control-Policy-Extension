import { fail, getAnswerText, getDatabaseApproverRows, hasRoleMatching, pass, skip } from "./utils.js";

const ACP15 = {
    id: "ACP15",
    name: "NPI Database Requirement via CMDB",
    category: "Non-Person Identifiers",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        const hasDatabaseEvidence = getDatabaseApproverRows(context).length > 0 || hasRoleMatching(context, /\bDBA\b|database administrator/i);
        const appRecord = (context.supportingData?.esatsBusapp || [])[0] || {};
        const isInternalWebApp = /internal web/i.test(`${appRecord.baAppTypeCategory || ""} ${appRecord.description || ""}`);

        if (!hasDatabaseEvidence && !isInternalWebApp) {
            return skip(this.id, "CAIRO and ESATS evidence did not establish that this application requires a database-backed NPI.");
        }

        const npiAnswer = getAnswerText(context, "ACP-NPI1");
        return /^yes$/i.test(npiAnswer.trim())
            ? pass(this.id, "Database/internal-web evidence exists and ACP-NPI1 is Yes.")
            : fail(this.id, "Database/internal-web evidence exists, but ACP-NPI1 is not Yes.");
    }
};

export default ACP15;
