import {
    collectValuesByKey,
    fail,
    findAssessmentById,
    pass
}
from "./utils.js";

const ACP1 = {

    id: "ACP1",

    name: "ACP has both approvals",

    category: "Approvals",

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