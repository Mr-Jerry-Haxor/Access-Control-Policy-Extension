import { buildReviewPrompt, fail, getRoleRows, needsReview, normalizeText, pass, roleLabel, rowValues, skip } from "./utils.js";

function containsAny(text, terms) {
    return terms.some(term => text.includes(term));
}

const ACP12 = {
    id: "ACP12",
    name: "Authorized entity agrees with person status and type",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP12",
        requirement: "Authorized Entity and other ACP statements do not conflict with each role's Person Status or Person Type.",
        targetQuestion: "ACP-AR1 and related ACP text",
        correction: "the exact conflicting fields and a minimally changed corrected value"
    }),
    async validate(context) {
        const rows = getRoleRows(context);
        if (!rows.length) return needsReview(this.id, "ACP-AR1 role rows are unavailable.");
        const conflicts = [];
        let comparable = 0;
        for (const row of rows) {
            const entity = normalizeText(rowValues(row, "authorizedEntity").join(" "));
            const statuses = normalizeText(rowValues(row, "personStatus").join(" "));
            const types = normalizeText(rowValues(row, "personType").join(" "));
            if (!entity || (!statuses && !types)) continue;
            comparable++;
            if (containsAny(entity, ["us persons only", "u s persons only"]) && /non us person/.test(statuses)) {
                conflicts.push(`${roleLabel(row)}: Authorized Entity is U.S.-only but Person Status includes Non-US Person`);
            }
            if (/boeing employees? only/.test(entity) && containsAny(types, ["purchased services", "contract labor", "supplier", "non boeing"])) {
                conflicts.push(`${roleLabel(row)}: Authorized Entity is Boeing-employees-only but Person Type includes non-Boeing personnel`);
            }
            if (containsAny(entity, ["compute 2 0", "enterprise compute program", "dell", "tcs", "hcl", "tech m"]) && !/purchased services/.test(types)) {
                conflicts.push(`${roleLabel(row)}: Authorized Entity implies Purchased Services but Person Type does not`);
            }
        }
        if (!comparable) return skip(this.id, "No row had both Authorized Entity and Person Status/Type values that could be compared.");
        return conflicts.length
            ? fail(this.id, conflicts.join("; "))
            : pass(this.id, `No explicit Authorized Entity conflict was found in ${comparable} comparable role row(s).`);
    }
};

export default ACP12;
