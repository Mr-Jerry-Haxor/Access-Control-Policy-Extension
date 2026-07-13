import { getAnswerText, getRoleRows, pass, fail } from "./utils.js";

const ACP12 = {
    id: "ACP12",
    name: "Access Levels Validation",
    category: "Access Roles",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        const rows = getRoleRows(context);
        if (rows.length > 0) {
            const invalid = rows.filter(row => {
                const levels = [row.accessToDB, row.accessToServer, row.accessToApplication]
                    .flat()
                    .filter(Boolean)
                    .map(String);
                return levels.length === 0 || levels.every(level => /^none$/i.test(level.trim()));
            });

            return invalid.length === 0
                ? pass(this.id, `At least one access level is selected for ${rows.length} role row(s).`)
                : fail(this.id, `All access levels are None or missing for role(s): ${invalid.map(row => row.role || row.rowGroupNumber).join(", ")}.`);
        }

        const ar1 = getAnswerText(context, "ACP-AR1");
        if (!ar1) return fail(this.id, "ACP-AR1 data is missing.");
        return fail(this.id, "ACP-AR1 role table could not be parsed from CAIRO question detail.");
    }
};

export default ACP12;
