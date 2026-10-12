import { buildReviewPrompt, collectValuesByKey, fail, findAssessmentById, needsReview, pass } from "./utils.js";

const ACP1 = {
    id: "ACP1",
    name: "ACP has both approvals",
    category: "Approvals",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP1",
        requirement: "The current ACP assessment has both required approvals.",
        targetQuestion: "assessment review summary",
        correction: "a short list of the missing or non-approved approval records; do not draft fictional approvals"
    }),
    async validate(context) {
        const assessmentId = context?.assessment?.assessmentId || context?.detail?.assessmentId;
        if (!assessmentId) return needsReview(this.id, "Assessment ID is unavailable.");
        if (!Array.isArray(context?.reviewSummary)) {
            return needsReview(this.id, "The CAIRO review-summary response is unavailable.");
        }
        const current = findAssessmentById(context.reviewSummary, assessmentId);
        if (!current) return needsReview(this.id, `Assessment ${assessmentId} is absent from the review-summary response.`);
        const votes = collectValuesByKey(current.reviews || current, "voteCode")
            .map(value => String(value || "").trim().toUpperCase())
            .filter(Boolean);
        if (votes.length < 2) return fail(this.id, `Expected two approval votes; found ${votes.length}.`);
        const rejected = votes.filter(vote => vote !== "A");
        return rejected.length
            ? fail(this.id, `Not all approval votes are approved. Vote codes: ${votes.join(", ")}.`)
            : pass(this.id, `All ${votes.length} recorded approval votes are approved.`);
    }
};

export default ACP1;
