import { fail, getAnswerText, needsReview, pass, skip } from "./utils.js";

const ACP18 = {
    id: "ACP18",
    name: "ICP Data Match",
    category: "Export Compliance",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        const nonUsAccess = getAnswerText(context, "ACP-EXPORT-NON-US");
        const exportData = getAnswerText(context, "ACP-EXPORT-1");
        const hasControlledData = /EAR License Required|EAR-LR|ITAR/i.test(exportData);
        if (!/^yes$/i.test(nonUsAccess.trim())) {
            return hasControlledData
                ? fail(this.id, "ACP-EXPORT-NON-US is No, but EAR-LR/ITAR was selected in ACP-EXPORT-1. Resolve the contradictory answers.")
                : skip(this.id, "Non-US access to EAR-LR/ITAR data is not indicated.");
        }
        if (!hasControlledData) {
            return fail(this.id, "ACP-EXPORT-NON-US is Yes, but no EAR-LR or ITAR data selection was found.");
        }

        const exportQuestion = context.normalizedQuestionMap?.get('ACP-EXPORT-1');
        if (exportQuestion?.questionDetailLoadError) {
            return needsReview(this.id, `Export authorization table could not be loaded: ${exportQuestion.questionDetailLoadError}`);
        }
        const rows = exportQuestion?.table?.rows || [];
        if (!rows.length) return fail(this.id, "Non-US access to EAR-LR/ITAR data is indicated, but no export authorization/ICP rows were found.");
        const authorizationText = exportQuestion.table.text || JSON.stringify(rows);
        return /ICP|TRAN|EAMS|authorization|license|\b(?:TA|D|M)-?\d/i.test(authorizationText)
            ? pass(this.id, "Export-controlled non-US access includes export authorization/ICP table evidence.")
            : fail(this.id, "Export authorization rows exist, but an ICP/export authorization identifier was not found.");
    }
};

export default ACP18;
