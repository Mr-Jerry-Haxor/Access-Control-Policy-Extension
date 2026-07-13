import { needsReview } from "./utils.js";

const ACP14 = {
    id: "ACP14",
    name: "NPI Match via Risk Profiler",
    category: "Non-Person Identifiers",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        return needsReview(this.id, "Risk Profiler service-account evidence is unavailable; an exact NPI comparison cannot be completed.");
    }
};

export default ACP14;
