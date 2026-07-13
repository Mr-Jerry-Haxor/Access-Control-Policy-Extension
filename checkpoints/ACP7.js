import { fail, hasRoleMatching, pass, skip } from "./utils.js";

const ACP7 = {
    id: "ACP7",
    name: "Tier 2/3 Tech Support via ESATS",
    category: "Access Roles",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        const esatsRoles = context.supportingData?.esatsRoles || [];
        const hasTierSupport = esatsRoles.some(role =>
            /tier\s*2|tier\s*3|technical support/i.test(`${role.roleType || ""} ${role.sourceContactType || ""}`)
        );

        if (!hasTierSupport) {
            return skip(this.id, "ESATS role data was loaded, but no Tier 2/3 Technical Support role was populated.");
        }

        return hasRoleMatching(context, /support|tier\s*2|tier\s*3/i)
            ? pass(this.id, "ESATS has Tier 2/3 Technical Support and ACP-AR1 includes an application support role.")
            : fail(this.id, "ESATS has Tier 2/3 Technical Support, but ACP-AR1 does not include an application support role.");
    }
};

export default ACP7;
