import { buildAiValidationPrompt, formatRoleRowsForAi, getAdditionalInformation, skip } from "./utils.js";

const REQUIREMENT = "Every ACP-AR1 role has an Authorized Entity that defines an eligible group without circular role-name references or authentication-only criteria and does not conflict with Risk Profiler CSIR-PersonClass.";

const ACP11 = {
    id: "ACP11",
    name: "Authorized entities are definable and consistent",
    category: "Access Roles",
    type: "AI",
    buildPrompt(context) {
        const roles = formatRoleRowsForAi(context);
        if (!roles.length) return null;
        return buildAiValidationPrompt({
            checkpointId: this.id,
            requirement: REQUIREMENT,
            decisionRules: "Evaluate every row. FAIL blank, circular definitions, authentication methods used as eligibility, IT&DA wording, or explicit conflict with Person Class labels. Team names are acceptable only when Additional Information documents them. Do not claim Insite alignment unless supplied evidence proves it; use REVIEW for that unavailable external comparison rather than inventing it.",
            evidence: {
                accessRoles: roles,
                riskProfilerPersonClass: (context.supportingData?.assetLabels || []).filter(label => /person type|person class/i.test(label.labelType || "")).map(label => label.label),
                additionalInformation: getAdditionalInformation(context),
                esatsApplication: context.supportingData?.esatsBusapp || []
            }
        });
    },
    async validate(context) {
        const prompt = this.buildPrompt(context);
        return prompt ? { checkpointId: this.id, type: "AI", prompt } : skip(this.id, "ACP-AR1 has no role rows.");
    }
};

export default ACP11;
