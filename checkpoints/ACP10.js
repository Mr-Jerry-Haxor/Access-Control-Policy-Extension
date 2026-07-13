import { getAnswerText, getRoleRows, pass, fail } from "./utils.js";

const ACP10 = {
    id: "ACP10",
    name: "Authorized Entity Validation",
    category: "Access Roles",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        const rows = getRoleRows(context);
        if (rows.length > 0) {
            const missing = rows.filter(row => !row.authorizedEntity);
            return missing.length === 0
                ? pass(this.id, `Authorized Entity is populated for ${rows.length} role row(s).`)
                : fail(this.id, `Authorized Entity is missing for role(s): ${missing.map(row => row.role || row.rowGroupNumber).join(", ")}.`);
        }

        const ar1 = getAnswerText(context, "ACP-AR1");
        if (!ar1) return fail(this.id, "ACP-AR1 data is missing.");
        if (ar1.includes("Authorized Entity")) return pass(this.id, "Authorized Entity information is present.");
        return fail(this.id, "Authorized Entity information could not be found.");
    }
};

export default ACP10;
