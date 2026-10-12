import { buildReviewPrompt, fail, getRoleRows, needsReview, pass, roleLabel, rowValues, skip } from "./utils.js";

const ACP23 = {
    id: "ACP23",
    name: "Non-US roles exclude undetermined U.S. export type",
    category: "Export Compliance",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP23",
        requirement: "No ACP-AR1 role with Person Status Non-US Person selects US Export - Not Yet Determined.",
        targetQuestion: "ACP-AR1",
        correction: "the exact conflicting role rows and Data Type selection to resolve"
    }),
    async validate(context) {
        const rows = getRoleRows(context);
        if (!rows.length) return needsReview(this.id, "ACP-AR1 role rows are unavailable.");
        const nonUsRows = rows.filter(row => rowValues(row, "personStatus").some(value => /non[- ]?us person/i.test(value)));
        if (!nonUsRows.length) return skip(this.id, "No ACP-AR1 role has Non-US Person status.");
        const conflicts = nonUsRows.filter(row =>
            rowValues(row, "dataType").some(value => /^US Export\s*-\s*Not Yet Determined$/i.test(value.trim()))
        );
        return conflicts.length
            ? fail(this.id, `US Export - Not Yet Determined is selected for: ${conflicts.map(roleLabel).join(", ")}.`)
            : pass(this.id, `None of the ${nonUsRows.length} Non-US role row(s) selects US Export - Not Yet Determined.`);
    }
};

export default ACP23;
