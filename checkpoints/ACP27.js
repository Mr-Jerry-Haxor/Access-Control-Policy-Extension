import { buildAiValidationPrompt, buildReviewPrompt, getAnswerText, skip } from "./utils.js";

const REQUIREMENT = "The access removal process does not contain the access validation process; it may only mention that validation can trigger use of the removal process.";

const ACP27 = {
    id: "ACP27", name: "Removal process is separate from access validation", category: "Request, Modify, Removal", type: "AI",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP27", requirement: REQUIREMENT, targetQuestion: "ACP-RAP1 removal process",
        correction: "a minimally changed removal subsection that retains deprovisioning steps and moves validation procedures out"
    }),
    buildPrompt(context) {
        const removal = getAnswerText(context, "ACP-RAP1");
        if (!removal.trim()) return null;
        return buildAiValidationPrompt({
            checkpointId: this.id, requirement: REQUIREMENT,
            decisionRules: "PASS when removal contains deprovisioning steps and at most a cross-reference to validation. FAIL when reconciliation, attestation, periodic review, AS-IS/SHOULD-BE comparison, or validation decision recording is embedded as part of removal.",
            evidence: { requestModifyRemoval: removal, separateAccessValidation: getAnswerText(context, "ACP-RAP3") }
        });
    },
    async validate(context) { const prompt = this.buildPrompt(context); return prompt ? { checkpointId: this.id, type: "AI", prompt } : skip(this.id, "ACP-RAP1 is missing."); }
};
export default ACP27;
