import { buildReviewPrompt, fail, getRoleRows, needsReview, normalizeText, pass, roleLabel, rowValues, skip } from "./utils.js";

const LEVEL_PATTERNS = [
    ["root", /\b(root|superuser|uid\s*0|system administrator|host administrator|local administrator|domain administrator|enterprise administrator)\b/i],
    ["admin", /\b(admin|administrative|application administrator|configuration manager|moderator|curator|full control)\b/i],
    ["elevated", /\b(elevated|privileged|escalated|supervisor|power user|special use)\b/i],
    ["write", /\b(write|modify|read write|write only|create|update|edit|append|change|commit|upload|submit|delete)\b/i],
    ["read", /\b(read|view|read only|retrieve|display|browse|inspect|consume|download)\b/i]
];

function statedLevelNear(text, subject) {
    const subjectMatch = subject.exec(text);
    if (!subjectMatch) return "";
    const subjectIndex = subjectMatch.index;
    const window = text.slice(Math.max(0, subjectIndex - 100), subjectIndex + subjectMatch[0].length + 100);
    if (!/\b(access|permission|privilege|read only|write only|full control)\b/i.test(window)) return "";
    const candidates = LEVEL_PATTERNS.flatMap(([level, pattern]) =>
        [...text.matchAll(new RegExp(pattern.source, "ig"))].map(match => ({ level, distance: Math.abs(match.index - subjectIndex) }))
    ).filter(candidate => candidate.distance <= 100).sort((a, b) => a.distance - b.distance);
    return candidates[0]?.level || "";
}

function levelMatches(selected, expected) {
    const normalized = normalizeText(selected);
    return normalized === expected || (expected === "admin" && /admin|full control/.test(normalized));
}

const ACP14 = {
    id: "ACP14",
    name: "Responsibility access statements match access levels",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP14",
        requirement: "When a Responsibility states an access type, it matches the Database, Server, or Application access-level selection using the published synonyms.",
        targetQuestion: "ACP-AR1",
        correction: "the exact Responsibility or access-level correction for each mismatch"
    }),
    async validate(context) {
        const rows = getRoleRows(context);
        if (!rows.length) return needsReview(this.id, "ACP-AR1 role rows are unavailable.");
        const mismatches = [];
        let claims = 0;
        for (const row of rows) {
            const responsibility = rowValues(row, "responsibility").join(" ");
            for (const [label, key, subject] of [
                ["Database", "accessToDB", /\b(database|db)\b/i],
                ["Server", "accessToServer", /\b(server|host|operating system|\bos\b)\b/i],
                ["Application", "accessToApplication", /\b(application|app)\b/i]
            ]) {
                const expected = statedLevelNear(responsibility, subject);
                if (!expected) continue;
                claims++;
                const selected = rowValues(row, key);
                if (!selected.some(level => levelMatches(level, expected))) {
                    mismatches.push(`${roleLabel(row)}: Responsibility states ${expected} ${label} access, selected ${selected.join("/") || "missing"}`);
                }
            }
        }
        if (!claims) return skip(this.id, "No Responsibility states a recognizable Database, Server, or Application access level.");
        return mismatches.length
            ? fail(this.id, mismatches.join("; "))
            : pass(this.id, `All ${claims} explicit Responsibility access statement(s) match their selected access levels.`);
    }
};

export default ACP14;
