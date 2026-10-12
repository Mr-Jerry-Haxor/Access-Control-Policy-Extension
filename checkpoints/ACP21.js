import { buildAiValidationPrompt, buildReviewPrompt, formatRoleRowsForAi, getAnswerText, skip } from "./utils.js";

const REQUIREMENT = "Every ACP-AR1 role allowing Non-US Persons access to export-controlled data other than NLR has a corresponding ACP-EXPORT-1 ICP entry that does not conflict with that role.";

const ACP21 = {
    id: "ACP21",
    name: "Non-US export roles have corresponding ICP entries",
    category: "Export Compliance",
    type: "AI",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP21",
        requirement: REQUIREMENT,
        targetQuestion: "ACP-AR1 and ACP-EXPORT-1",
        correction: "a role-by-role list of missing or conflicting ICP fields without inventing authorization data"
    }),
    buildPrompt(context) {
        const roles = formatRoleRowsForAi(context);
        if (!roles.length) return null;
        return buildAiValidationPrompt({
            checkpointId: this.id,
            requirement: REQUIREMENT,
            decisionRules: "NA only if no role grants Non-US Persons licensed export data. Exclude NLR. PASS only when every applicable role maps to an ICP entry and role fields do not conflict. FAIL missing or contradictory mappings.",
            evidence: {
                accessRoles: roles,
                exportAnswer: getAnswerText(context, "ACP-EXPORT-1"),
                exportTable: context.normalizedQuestionMap?.get("ACP-EXPORT-1")?.table || null
            }
        });
    },
    async validate(context) {
        const prompt = this.buildPrompt(context);
        return prompt ? { checkpointId: this.id, type: "AI", prompt } : skip(this.id, "ACP-AR1 has no role rows.");
    }
};

export default ACP21;
