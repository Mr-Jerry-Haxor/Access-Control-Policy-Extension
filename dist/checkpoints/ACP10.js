import { buildReviewPrompt, fail, getRoleRows, needsReview, normalizeText, pass, roleLabel, rowValues } from "./utils.js";

function selectedLevels(row) {
    return rowValues(row, "accessToDB", "accessToServer", "accessToApplication").map(normalizeText);
}

const ACP10 = {
    id: "ACP10",
    name: "Role name agrees with role fields",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP10",
        requirement: "Each role name is consistent with access levels and other fields in that role row.",
        targetQuestion: "ACP-AR1",
        correction: "exact role-name or field corrections for each conflicting row"
    }),
    async validate(context) {
        const rows = getRoleRows(context);
        if (!rows.length) return needsReview(this.id, "ACP-AR1 role rows are unavailable.");
        const conflicts = [];
        for (const row of rows) {
            const name = normalizeText(rowValues(row, "role").join(" "));
            const levels = selectedLevels(row);
            const has = pattern => levels.some(level => pattern.test(level));
            if (/\b(root|superuser)\b/.test(name) && !has(/root|superuser/)) conflicts.push(`${roleLabel(row)}: role name implies Root`);
            else if (/\b(admin|administrator)\b/.test(name) && !has(/admin|elevated|root|full control/)) conflicts.push(`${roleLabel(row)}: role name implies Admin/Elevated`);
            else if (/\bread only\b/.test(name) && (has(/write|modify|admin|elevated|root/) || !has(/read|view/))) conflicts.push(`${roleLabel(row)}: Read-Only name conflicts with access level`);
            else if (/\bwrite only\b/.test(name) && (has(/read|admin|elevated|root/) || !has(/write|modify/))) conflicts.push(`${roleLabel(row)}: Write-Only name conflicts with access level`);
        }
        return conflicts.length
            ? fail(this.id, `Role-name conflicts: ${conflicts.join("; ")}.`)
            : pass(this.id, `No explicit role-name/access-level conflicts were found in ${rows.length} role row(s).`);
    }
};

export default ACP10;
