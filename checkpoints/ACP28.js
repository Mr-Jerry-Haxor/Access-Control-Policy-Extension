import { buildAiValidationPrompt, buildReviewPrompt, formatRoleRowsForAi, getAnswerText, skip } from "./utils.js";

const REQUIREMENT = "Every ACP-AR1 role has an executable step-by-step approval/processing workflow; when STAR provisions access, the STAR approval workflow is documented.";

const ACP28 = {
    id: "ACP28", name: "Approval process covers every role", category: "Approval Process", type: "AI",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP28", requirement: REQUIREMENT, targetQuestion: "ACP-RAP2",
        correction: "a complete numbered approval workflow for every exact role, including evidenced STAR routing and placeholders for missing approvers"
    }),
    buildPrompt(context) {
        const approval = getAnswerText(context, "ACP-RAP2");
        if (!approval.trim()) return null;
        return buildAiValidationPrompt({
            checkpointId: this.id, requirement: REQUIREMENT,
            decisionRules: "PASS only if a person processing access can execute the steps for every role. If STAR is named in request/provisioning evidence, require STAR approval routing in ACP-RAP2.",
            evidence: {
                accessRoles: formatRoleRowsForAi(context),
                approval,
                requestModifyRemoval: getAnswerText(context, "ACP-RAP1")
            }
        });
    },
    async validate(context) { const prompt = this.buildPrompt(context); return prompt ? { checkpointId: this.id, type: "AI", prompt } : skip(this.id, "ACP-RAP2 is missing."); }
};
export default ACP28;
