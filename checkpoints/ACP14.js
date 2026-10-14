import { buildAiValidationPrompt, buildReviewPrompt, formatRoleRowsForAi, skip } from "./utils.js";

const REQUIREMENT = "When an ACP-AR1 Responsibility states a Database, Server, or Application access level, the statement matches the corresponding selected access level using the approved synonyms.";

const ACP14 = {
    id: "ACP14",
    name: "Responsibility access statements match access levels",
    category: "Access Roles",
    type: "AI",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP14",
        requirement: REQUIREMENT,
        targetQuestion: "ACP-AR1 Responsibility and access-level fields",
        correction: "the exact Responsibility or access-level correction for each mismatched role and scope"
    }),
    buildPrompt(context) {
        const roles = formatRoleRowsForAi(context);
        if (!roles.length) return null;
        return buildAiValidationPrompt({
            checkpointId: this.id,
            requirement: REQUIREMENT,
            decisionRules: "Evaluate every role row separately. Identify each explicit access-level claim in Responsibility, determine whether it refers to Database, Server, or Application access, and compare it only with the corresponding accessToDB, accessToServer, or accessToApplication value in that same row. Use these synonym groups: Read = read, view, read-only, retrieve, display, browse, inspect, consume, or download when it means copying or receiving; Write = write, modify, read/write, write-only, create, update, edit, append, change, commit, upload, submit, or delete; Elevated = elevated, privileged, escalated, supervisor, power-user, or special-use; Admin = admin, full control, administrative, application administrator, configuration manager for the application, moderator, or curator; Root = root, superuser, UID 0, system administrator at OS level, host administrator, local administrator, domain administrator, or enterprise administrator. Treat local administrator and server administrator wording as OS-level privileged access that must map to the Server scope and be limited to administration or maintenance responsibilities. Do not treat a more privileged selection as automatically matching a lower access claim merely because it technically includes that capability. Evaluate every explicit claim when one responsibility contains multiple scopes or levels. Ignore a row whose Responsibility makes no access-level claim, but do not ignore explicit synonyms. Return NA only when none of the supplied role Responsibilities states a recognizable access level. Return PASS only when every explicit scoped claim matches its corresponding selected field and no privileged local/server administrator responsibility conflicts with the administration-or-maintenance restriction. Return FAIL for a direct mismatch, wrong scope, missing corresponding selection, or conflicting privileged-role purpose. Return REVIEW when an access claim is recognizable but its scope or meaning is genuinely ambiguous. Do not invent access, scope, controls, or responsibilities.",
            evidence: { accessRoles: roles }
        });
    },
    async validate(context) {
        const prompt = this.buildPrompt(context);
        return prompt ? { checkpointId: this.id, type: "AI", prompt } : skip(this.id, "ACP-AR1 has no role rows.");
    }
};

export default ACP14;
