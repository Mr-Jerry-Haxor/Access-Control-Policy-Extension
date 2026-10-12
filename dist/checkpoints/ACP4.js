import { buildReviewPrompt, needsReview, skip } from "./utils.js";

const ACP4 = {
    id: "ACP4",
    name: "Online request form roles match",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP4",
        requirement: "Role names in the documented online request form match ACP-AR1, subject to the listed N/A exceptions.",
        targetQuestion: "ACP-AR1 and ACP-RAP1",
        correction: "an exact mismatch list or the evidenced N/A rationale"
    }),
    async validate(context) {
        const requestText = context.getAnswerText?.("ACP-RAP1") || "";
        if (!/\b(STAR|MARS|IDAP|online (request )?form)\b/i.test(requestText)) {
            return skip(this.id, "No online request form is documented in ACP-RAP1.");
        }
        return needsReview(this.id, "An online request form is documented, but its authoritative role list is not available in the captured CAIRO responses.");
    }
};

export default ACP4;
