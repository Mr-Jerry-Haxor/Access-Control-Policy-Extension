import {
    collectValuesByKey,
    fail,
    findAssessmentById,
    needsReview,
    pass,
    skip
}
from "./utils.js";

const ACP1 = {

    id: "ACP1",

    name: "ACP has both approvals",

    category: "Approvals",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,

    async validate(context) {

        const assessmentId =
            context?.application?.assessmentId ||
            context?.assessment?.assessmentId;

        if (!assessmentId) {

            return fail(
                this.id,
                "Assessment ID not found."
            );
        }

        const matchedAssessment =
            findAssessmentById(
                context?.reviewSummary,
                assessmentId
            );

        if (!matchedAssessment) {

            return fail(
                this.id,
                `Assessment ${assessmentId} not found in review summary.`
            );
        }

        const votes =
            collectValuesByKey(
                matchedAssessment,
                "voteCode"
            )
            .filter(Boolean);

        if (votes.length === 0) {
            return needsReview(
                this.id,
                "Review summary endpoint was loaded, but approval voteCode values were not present in the CAIRO response."
            );
        }

        if (
            votes.length < 2
        ) {

            return fail(
                this.id,
                `Expected 2 approvals but found ${votes.length}.`
            );
        }

        const approved =
            votes
            .slice(0, 2)
            .every(
                vote =>
                    String(vote)
                    .trim() === "A"
            );

        return approved

            ? pass(
                this.id,
                "Both approval vote codes are A."
            )

            : fail(
                this.id,
                `Approval vote codes: ${votes.join(", ")}`
            );
    }
};

export default ACP1;
