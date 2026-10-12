import { buildReviewPrompt, evidenceUnavailable, fail, getAnswerText, needsReview, pass, skip } from "./utils.js";

const ACP17 = {
    id: "ACP17",
    name: "Internal web or database application has an NPI",
    category: "Non-Person Identifiers",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP17",
        requirement: "An internal web application or an application with a database lists at least one NPI in ACP-NPI1.",
        targetQuestion: "ACP-NPI1",
        correction: "the required NPI table row fields, or the evidenced N/A rationale"
    }),
    async validate(context) {
        const databases = context.supportingData?.gsepDatabases;
        const busapps = context.supportingData?.esatsBusapp;
        if (evidenceUnavailable(databases) && evidenceUnavailable(busapps)) {
            return needsReview(this.id, "Database and ESATS application-type evidence are unavailable.");
        }
        const hasDatabase = Array.isArray(databases) && databases.length > 0;
        const appText = JSON.stringify(Array.isArray(busapps) ? busapps : []);
        const internalWeb = /\b(web based|web application|internal web|intranet)\b/i.test(appText);
        if (!hasDatabase && !internalWeb) return skip(this.id, "Available evidence does not identify an internal web application or database.");
        const answer = getAnswerText(context, "ACP-NPI1").trim();
        const rows = context.supportingData?.questionTables?.["ACP-NPI1"]?.rows || [];
        if (!/^yes$/i.test(answer)) return fail(this.id, "The application is internal-web/database-backed, but ACP-NPI1 is not Yes.");
        return rows.length
            ? pass(this.id, `ACP-NPI1 is Yes and lists ${rows.length} NPI row(s).`)
            : fail(this.id, "ACP-NPI1 is Yes, but no NPI rows are listed.");
    }
};

export default ACP17;
