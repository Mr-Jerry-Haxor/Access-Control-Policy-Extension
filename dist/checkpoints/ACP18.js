import { buildReviewPrompt, fail, getAnswerText, getNpiRows, pass, roleLabel, rowValues, skip } from "./utils.js";

const ACTION_VERBS = /\b(authenticat(?:e|es|ing)|authoriz(?:e|es|ing)|allow(?:s|ed|ing)?|connect(?:s|ed|ing)?|communicat(?:e|es|ing)|creat(?:e|es|ing)|delet(?:e|es|ing)|download(?:s|ed|ing)?|execut(?:e|es|ing)|generat(?:e|es|ing)|host(?:s|ed|ing)?|import(?:s|ed|ing)?|integrat(?:e|es|ing)|monitor(?:s|ed|ing)?|process(?:es|ed|ing)?|publish(?:es|ed|ing)?|read(?:s|ing)?|receiv(?:e|es|ing)|retriev(?:e|es|ing)|run(?:s|ning)?|send(?:s|ing)?|serv(?:e|es|ing)|stor(?:e|es|ing)|synchroniz(?:e|es|ing)|transfer(?:s|red|ring)?|updat(?:e|es|ing)|upload(?:s|ed|ing)?|writ(?:e|es|ing))\b/i;

const ACP18 = {
    id: "ACP18",
    name: "NPI functions describe actions",
    category: "Non-Person Identifiers",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP18",
        requirement: "Every NPI Function describes an action performed by that identifier.",
        targetQuestion: "ACP-NPI1 Function",
        correction: "a short action-oriented Function value for each deficient NPI, using only known purpose facts"
    }),
    async validate(context) {
        if (/^no$/i.test(getAnswerText(context, "ACP-NPI1").trim())) return skip(this.id, "ACP-NPI1 is No.");
        const rows = getNpiRows(context);
        if (!rows.length) return fail(this.id, "No NPI table rows are listed.");
        const invalid = rows.filter(row => {
            const text = rowValues(row, "function").join(" ");
            return !text || !ACTION_VERBS.test(text);
        });
        return invalid.length
            ? fail(this.id, `Function is missing or not action-oriented for: ${invalid.map(row => rowValues(row, "nonPersonIdentifier")[0] || roleLabel(row)).join(", ")}.`)
            : pass(this.id, `All ${rows.length} NPI Function value(s) describe an action.`);
    }
};

export default ACP18;
