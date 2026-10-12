import { buildReviewPrompt, getAnswerText, needsReview } from "./utils.js";

const ACP16 = {
    id: "ACP16",
    name: "NPI answer matches Risk Profiler service-account answer",
    category: "Non-Person Identifiers",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP16",
        requirement: "ACP-NPI1 matches Risk Profiler CSIR-SvcAcct.",
        targetQuestion: "ACP-NPI1",
        correction: "the correct Yes/No selection only when CSIR-SvcAcct evidence proves it"
    }),
    async validate(context) {
        const acpAnswer = getAnswerText(context, "ACP-NPI1").trim();
        if (!/^(yes|no)$/i.test(acpAnswer)) {
            return needsReview(this.id, "ACP-NPI1 does not contain a usable Yes/No answer.");
        }
        const riskProfiler = context.supportingData?.riskProfilerAnswers?.["CSIR-SvcAcct"];
        if (!/^(yes|no)$/i.test(String(riskProfiler || "").trim())) {
            return needsReview(this.id, `ACP-NPI1 is ${acpAnswer}, but authoritative CSIR-SvcAcct evidence is unavailable.`);
        }
        return acpAnswer.toLowerCase() === String(riskProfiler).trim().toLowerCase()
            ? { checkpointId: this.id, status: "PASS", message: `ACP-NPI1 and CSIR-SvcAcct are both ${acpAnswer}.` }
            : { checkpointId: this.id, status: "FAIL", message: `ACP-NPI1 is ${acpAnswer}; CSIR-SvcAcct is ${riskProfiler}.` };
    }
};

export default ACP16;
