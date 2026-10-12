import { buildAiValidationPrompt, buildReviewPrompt, formatRoleRowsForAi, getAdditionalInformation, skip } from "./utils.js";

const REQUIREMENT = "Each ACP-AR1 role has action-oriented responsibilities commensurate with its title; separately defined ESATS roles remain separate, and Data Solutions DBA wording is used when applicable.";

const ACP8 = {
    id: "ACP8",
    name: "Role responsibilities are complete and commensurate",
    category: "Access Roles",
    type: "AI",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP8",
        requirement: REQUIREMENT,
        targetQuestion: "ACP-AR1",
        correction: "a complete corrected Responsibility value for each deficient role row"
    }),
    buildPrompt(context) {
        const roles = formatRoleRowsForAi(context);
        if (!roles.length) return null;
        return buildAiValidationPrompt({
            checkpointId: this.id,
            requirement: REQUIREMENT,
            decisionRules: "Evaluate every row separately. A responsibility must state work actions, not merely access level or role title. Apply N/A only when Additional Information explicitly explains the omission at the application team's request. Do not invent Data Solutions wording.",
            evidence: {
                accessRoles: roles,
                esatsRoleTypes: (context.supportingData?.esatsRoles || []).map(role => role.roleType || role.sourceContactType).filter(Boolean),
                databases: context.supportingData?.gsepDatabases || [],
                additionalInformation: getAdditionalInformation(context)
            }
        });
    },
    async validate(context) {
        const prompt = this.buildPrompt(context);
        return prompt ? { checkpointId: this.id, type: "AI", prompt } : skip(this.id, "ACP-AR1 has no role rows.");
    }
};

export default ACP8;
