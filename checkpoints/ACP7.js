import {
    buildAiValidationPrompt,
    buildReviewPrompt,
    evidenceUnavailable,
    fail,
    formatRoleRowsForAi,
    getAdditionalInformation,
    hasRoleMatching,
    needsReview,
    pass,
    skip
} from "./utils.js";

const REQUIREMENT = "If ESATS has Tier 2/3 Technical Support, ACP-AR1 includes an application-support role unless ACP-AI2 clearly documents a valid exception.";

const ACP7 = {
    id: "ACP7",
    name: "Tier 2/3 support role represented",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP7",
        requirement: REQUIREMENT,
        targetQuestion: "ACP-AR1 and ACP-AI2",
        correction: "the missing application-support role fields or a clear application-specific ACP-AI2 exception rationale"
    }),
    buildFailurePrompt(context) {
        return buildAiValidationPrompt({
            checkpointId: this.id,
            requirement: REQUIREMENT,
            decisionRules: "The deterministic check found an ESATS Tier 2/3 Technical Support role but no corresponding application-support role in ACP-AR1. Use AI judgment to evaluate ACP-AI2 for an explicit, application-specific exception. Return NA only when ACP-AI2 clearly explains why the ESATS Tier 2/3 association does not require a separate application-support role in this ACP and identifies where or how that support responsibility is handled, or clearly documents that the ESATS association is incorrect or no longer applicable. Return FAIL when ACP-AI2 is blank, vague, unrelated, merely repeats that no role exists, or does not resolve the missing role. Return REVIEW when the explanation is relevant but ambiguous or cannot be verified from the supplied evidence. Do not return PASS because ACP-AR1 has no matching support role. Do not invent teams, systems, ownership, or support arrangements.",
            evidence: {
                esatsRoles: context.supportingData?.esatsRoles || [],
                accessRoles: formatRoleRowsForAi(context),
                additionalInformationQuestion: "ACP-AI2",
                additionalInformation: getAdditionalInformation(context)
            }
        });
    },
    async validate(context) {
        const esatsRoles = context.supportingData?.esatsRoles;
        if (evidenceUnavailable(esatsRoles)) return needsReview(this.id, "The ESATS role response is unavailable.");
        const hasTierSupport = (esatsRoles || []).some(role =>
            /tier\s*2\s*\/\s*3\s*technical support/i.test(`${role.roleType || ""} ${role.sourceContactType || ""}`)
        );
        if (!hasTierSupport) return skip(this.id, "ESATS has no Tier 2/3 Technical Support role.");
        return hasRoleMatching(context, /application support|tier\s*2|tier\s*3|support.*level/i)
            ? pass(this.id, "ESATS Tier 2/3 Technical Support is represented by an ACP application-support role.")
            : fail(this.id, "ESATS has Tier 2/3 Technical Support, but ACP-AR1 has no application-support role. ACP-AI2 requires AI verification.");
    }
};

export default ACP7;
