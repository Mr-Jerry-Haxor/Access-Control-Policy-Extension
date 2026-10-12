import { buildReviewPrompt, evidenceUnavailable, fail, hasRoleMatching, needsReview, pass, skip } from "./utils.js";

const ACP7 = {
    id: "ACP7",
    name: "Tier 2/3 support role represented",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP7",
        requirement: "If ESATS has Tier 2/3 Technical Support, ACP-AR1 includes an application support role.",
        targetQuestion: "ACP-AR1",
        correction: "the missing application-support role fields"
    }),
    async validate(context) {
        const esatsRoles = context.supportingData?.esatsRoles;
        if (evidenceUnavailable(esatsRoles)) return needsReview(this.id, "The ESATS role response is unavailable.");
        const hasTierSupport = (esatsRoles || []).some(role =>
            /tier\s*2\s*\/\s*3\s*technical support/i.test(`${role.roleType || ""} ${role.sourceContactType || ""}`)
        );
        if (!hasTierSupport) return skip(this.id, "ESATS has no Tier 2/3 Technical Support role.");
        return hasRoleMatching(context, /application support|tier\s*2|tier\s*3|support.*level/i)
            ? pass(this.id, "ESATS Tier 2/3 Technical Support is represented by an ACP application-support role.")
            : fail(this.id, "ESATS has Tier 2/3 Technical Support, but ACP-AR1 has no application-support role.");
    }
};

export default ACP7;
