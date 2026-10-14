import { buildReviewPrompt, fail, getAnswerText, needsReview, normalizeText, pass, skip } from "./utils.js";

function answerValues(value) {
    return (Array.isArray(value) ? value : [value])
        .map(item => String(item ?? "").trim())
        .filter(Boolean);
}

function isInternalWebApplication(appTypes) {
    return appTypes.some(value =>
        /\b(web application|web based application|internal web application|internal web|intranet application|intranet)\b/.test(normalizeText(value))
    );
}

const ACP17 = {
    id: "ACP17",
    name: "Internal web or database application has an NPI",
    category: "Non-Person Identifiers",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP17",
        requirement: "ACP17 is N/A when ACP-NPI1 is No; otherwise, when Risk Profiler identifies an internal web application or CSIR-Database is Yes, ACP-NPI1 lists at least one NPI.",
        targetQuestion: "ACP-NPI1, Risk Profiler CSIR-AppType, and Risk Profiler CSIR-Database",
        correction: "the required NPI table row fields, or the evidenced N/A rationale"
    }),
    async validate(context) {
        const answer = getAnswerText(context, "ACP-NPI1").trim();
        if (/^no$/i.test(answer)) return skip(this.id, "ACP-NPI1 is No.");

        const riskProfiler = context.supportingData?.riskProfiler;
        if (riskProfiler?.status !== "found") {
            return needsReview(this.id, "The matching Risk Profiler last assessment is unavailable for ACP17.");
        }

        const appTypes = answerValues(riskProfiler.answers?.["CSIR-AppType"]);
        const databaseAnswer = normalizeText(riskProfiler.answers?.["CSIR-Database"]);
        const internalWeb = isInternalWebApplication(appTypes);
        const databaseKnown = databaseAnswer === "yes" || databaseAnswer === "no";
        const hasDatabase = databaseAnswer === "yes";
        const evidence = `Risk Profiler assessment ${riskProfiler.assessmentId || "unknown"}: CSIR-AppType is ${appTypes.join(", ") || "unanswered"}; CSIR-Database is ${databaseKnown ? riskProfiler.answers["CSIR-Database"] : "unanswered"}.`;

        if (!internalWeb && !hasDatabase) {
            if (!appTypes.length || !databaseKnown) {
                return needsReview(this.id, `Risk Profiler evidence is incomplete; both conditions cannot be ruled out. ${evidence}`);
            }
            return skip(this.id, `Risk Profiler does not identify a Web Application and CSIR-Database is No. ${evidence}`);
        }

        const rows = context.supportingData?.questionTables?.["ACP-NPI1"]?.rows || [];
        if (!/^(yes|no)$/i.test(answer)) {
            return needsReview(this.id, `ACP-NPI1 does not contain a usable Yes/No answer. ${evidence}`);
        }
        return rows.length
            ? pass(this.id, `ACP-NPI1 is Yes and lists ${rows.length} NPI row(s). ${evidence}`)
            : fail(this.id, `ACP-NPI1 is Yes, but no NPI rows are listed. ${evidence}`);
    }
};

export default ACP17;
