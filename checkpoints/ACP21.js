import { fail, getAnswerText, hasAnyLabel, pass, skip } from "./utils.js";

const ACP21 = {
    id: "ACP21",
    name: "Sensitive PII Match via Risk Profiler",
    category: "PII Access Rules",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        const hasSensitivePii = hasAnyLabel(context, /Highly Sensitive|Sensitive Personal|Regulated PII|PI-Hi|PI-S/i, "Data Types");
        if (!hasSensitivePii) {
            return skip(this.id, "CAIRO asset labels do not indicate sensitive or regulated PII.");
        }

        const answer = getAnswerText(context, "ACP-PIAR2");
        return /^yes$/i.test(answer.trim())
            ? pass(this.id, "Sensitive/regulated PII is indicated and ACP-PIAR2 is Yes.")
            : fail(this.id, "Sensitive/regulated PII is indicated, but ACP-PIAR2 is not Yes.");
    }
};

export default ACP21;
