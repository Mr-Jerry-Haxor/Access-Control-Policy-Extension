import { buildAiValidationPrompt, formatRoleRowsForAi, getAnswerText, skip } from "./utils.js";

const REQUIREMENT = "Every ACP-AR1 role must be named and have a process defined in the Request, Approval, and Removal portions of the ACP.";

const ACP3 = {
    id: "ACP3",
    name: "Role coverage in request, approval, and removal",
    category: "Access Roles",
    type: "AI",
    buildPrompt(context) {
        const roles = formatRoleRowsForAi(context);
        if (!roles.length) return null;
        return buildAiValidationPrompt({
            checkpointId: this.id,
            requirement: REQUIREMENT,
            decisionRules: "PASS only if every exact role is covered by request, approval, and removal/deactivation. FAIL when at least one role or one required process is demonstrably missing. Do not require literal repetition when an evidenced phrase unambiguously covers a defined group of roles.",
            evidence: {
                accessRoles: roles,
                requestModifyRemoval: getAnswerText(context, "ACP-RAP1"),
                approval: getAnswerText(context, "ACP-RAP2")
            }
        });
    },
    async validate(context) {
        const prompt = this.buildPrompt(context);
        return prompt ? { checkpointId: this.id, type: "AI", prompt } : skip(this.id, "ACP-AR1 has no role rows.");
    }
};

export default ACP3;
