import { buildReviewPrompt, fail, getRoleRows, needsReview, normalizeText, pass, roleLabel, rowValues } from "./utils.js";

const ACP13 = {
    id: "ACP13",
    name: "Every role has an access level",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP13",
        requirement: "Every role has at least one Database, Server, or Application access level other than None.",
        targetQuestion: "ACP-AR1",
        correction: "the missing access-level field for each deficient role"
    }),
    async validate(context) {
        const rows = getRoleRows(context);
        if (!rows.length) return needsReview(this.id, "ACP-AR1 role rows are unavailable.");
        const invalid = rows.filter(row => {
            const levels = rowValues(row, "accessToDB", "accessToServer", "accessToApplication").map(normalizeText);
            return !levels.length || levels.every(level => !level || level === "none");
        });
        return invalid.length
            ? fail(this.id, `All access levels are None or missing for: ${invalid.map(roleLabel).join(", ")}.`)
            : pass(this.id, `All ${rows.length} role row(s) have at least one non-None access level.`);
    }
};

export default ACP13;
