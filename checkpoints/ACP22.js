import { buildAiValidationPrompt, buildReviewPrompt, formatRoleRowsForAi, getAdditionalInformation, skip } from "./utils.js";

const REQUIREMENT = "For each role with license-restricted non-U.S. export data, Authorized Entity states the allowed countries; any different-country or U.S.-Person access has a GTC authorization in Additional Information.";

const ACP22 = {
    id: "ACP22",
    name: "License-restricted country and authorization rules",
    category: "Export Compliance",
    type: "AI",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP22",
        requirement: REQUIREMENT,
        targetQuestion: "ACP-AR1 Authorized Entity and ACP-AI2",
        correction: "the missing country restriction or authorization reference for each applicable role, with placeholders for unavailable GTC facts"
    }),
    buildPrompt(context) {
        const roles = formatRoleRowsForAi(context);
        if (!roles.length) return null;
        return buildAiValidationPrompt({
            checkpointId: this.id,
            requirement: REQUIREMENT,
            decisionRules: "NA when no role has a non-U.S. license-restricted data type. Do not treat U.S. NLR as license restricted. FAIL when applicable Authorized Entity omits countries or when a different-country/U.S.-Person population lacks an evidenced GTC authorization.",
            evidence: {
                accessRoles: roles,
                additionalInformation: getAdditionalInformation(context)
            }
        });
    },
    async validate(context) {
        const prompt = this.buildPrompt(context);
        return prompt ? { checkpointId: this.id, type: "AI", prompt } : skip(this.id, "ACP-AR1 has no role rows.");
    }
};

export default ACP22;
