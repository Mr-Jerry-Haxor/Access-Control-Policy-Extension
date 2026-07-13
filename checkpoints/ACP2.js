import { getAnswerText, pass, fail } from "./utils.js";

const ACP2 = {
    id: "ACP2",
    name: "Application Functionality Statement",
    category: "General",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        const text = getAnswerText(context, "ACP-AA1");
        if (text && text.trim().length > 0) {
            return pass(this.id, "Functionality statement is present.");
        }
        return fail(this.id, "No functionality statement found for ACP-AA1.");
    }
};

export default ACP2;
