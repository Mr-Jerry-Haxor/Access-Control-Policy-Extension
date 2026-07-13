import { fail, getAnswerText, hasAnyLabel, pass } from "./utils.js";

const ACP20 = {
    id: "ACP20",
    name: "PII Match via Risk Profiler",
    category: "PII Access Rules",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        const piiAnswer = getAnswerText(context, "ACP-PIAR1");
        const hasPiiLabel = hasAnyLabel(context, /PII|Personal Information/i, "Data Types");
        const answerYes = /^yes$/i.test(piiAnswer.trim());

        return answerYes === hasPiiLabel
            ? pass(this.id, "ACP-PIAR1 matches CAIRO asset data-type labels for PII.")
            : fail(this.id, `ACP-PIAR1 is ${piiAnswer || "blank"}, but CAIRO asset labels ${hasPiiLabel ? "include" : "do not include"} PII.`);
    }
};

export default ACP20;
