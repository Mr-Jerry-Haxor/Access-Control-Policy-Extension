import { fail, getAnswerText, hasAnyLabel, pass } from "./utils.js";

const ACP20 = {
    id: "ACP20",
    name: "PII Match via Risk Profiler",
    category: "PII Access Rules",
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
