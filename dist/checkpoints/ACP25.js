import { ADDITIONAL_INFORMATION_EXCEPTION_RULES, buildAiValidationPrompt, buildReviewPrompt, formatRoleRowsForAi, getAdditionalInformation, getAnswerText, skip } from "./utils.js";

const REQUIREMENT = "The Account Modify process gives step-by-step Who, What, and How instructions for every ACP-AR1 role and does not conflict with the role definitions.";

const ACP25 = {
    id: "ACP25", name: "Account modify process completeness", category: "Request, Modify, Removal", type: "AI",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP25", requirement: REQUIREMENT, targetQuestion: "ACP-RAP1 modify process and ACP-AI2",
        correction: "a complete numbered Modify subsection covering every exact role, using placeholders only for missing actors or tools"
    }),
    buildPrompt(context) {
        const process = getAnswerText(context, "ACP-RAP1");
        const additionalInformation = getAdditionalInformation(context);
        if (!process.trim() && !additionalInformation.trim()) return null;
        return buildAiValidationPrompt({
            checkpointId: this.id, requirement: REQUIREMENT,
            decisionRules: `Evaluate modification separately from request and removal. PASS only if each role is covered and each modification process states actor, action/decision, and method/tool/workflow. ${ADDITIONAL_INFORMATION_EXCEPTION_RULES}`,
            evidence: { accessRoles: formatRoleRowsForAi(context), requestModifyRemoval: process, additionalInformationQuestion: "ACP-AI2", additionalInformation }
        });
    },
    async validate(context) { const prompt = this.buildPrompt(context); return prompt ? { checkpointId: this.id, type: "AI", prompt } : skip(this.id, "ACP-RAP1 and ACP-AI2 are missing."); }
};
export default ACP25;
