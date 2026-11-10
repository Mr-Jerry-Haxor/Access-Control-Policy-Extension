import { fail, getRoleRows, needsReview, normalizeText, pass, roleLabel, rowValues } from "./utils.js";

const ACP13 = {
    id: "ACP13",
    name: "Every role has an access level",
    category: "Access Roles",
    type: "RULE",
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
