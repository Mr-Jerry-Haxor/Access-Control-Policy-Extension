import { buildAiValidationPrompt, buildReviewPrompt, formatRoleRowsForAi, skip } from "./utils.js";

const REQUIREMENT = "Each ACP-AR1 role name is semantically consistent with every other field in the same role row.";

const ACP10 = {
    id: "ACP10",
    name: "Role name agrees with role fields",
    category: "Access Roles",
    type: "AI",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP10",
        requirement: REQUIREMENT,
        targetQuestion: "ACP-AR1",
        correction: "exact role-name or field corrections for each conflicting row"
    }),
    buildPrompt(context) {
        const roles = formatRoleRowsForAi(context);
        if (!roles.length) return null;
        return buildAiValidationPrompt({
            checkpointId: this.id,
            requirement: REQUIREMENT,
            decisionRules: "Evaluate every ACP-AR1 row separately. Determine the ordinary access meaning explicitly conveyed by that row's role name, then compare it with the responsibility, environment, authorized entity, person status, person type, database access, server access, application access, and data type in the same row. Application Admin is only an example, not a required role or a special-case rule. Examples of meaningful name constraints include Admin or Administrator requiring elevated/admin-level access in the relevant scope, Root or Superuser requiring root-level access, Read-Only or Viewer conflicting with write/elevated/admin access, and Write-Only conflicting with read access. Also identify other direct semantic contradictions supported by the supplied row. Do not infer a conflict from a generic role name, and do not require every access field to be populated when the role name does not imply that scope. FAIL if any row has a direct conflict. PASS only when every row has no evidenced conflict. Use REVIEW when missing or ambiguous row data prevents a reliable decision. Do not use NA when role rows are present. Do not invent intended access or application-specific responsibilities.",
            evidence: { accessRoles: roles }
        });
    },
    async validate(context) {
        const prompt = this.buildPrompt(context);
        return prompt ? { checkpointId: this.id, type: "AI", prompt } : skip(this.id, "ACP-AR1 has no role rows.");
    }
};

export default ACP10;
