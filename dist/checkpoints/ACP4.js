import { needsReview, skip } from "./utils.js";

const ACP4 = {
    id: "ACP4",
    name: "Online request form roles match",
    category: "Access Roles",
    type: "RULE",
    async validate(context) {
        const requestText = context.getAnswerText?.("ACP-RAP1") || "";
        if (!/\b(STAR|MARS|IDAP|online (request )?form)\b/i.test(requestText)) {
            return skip(this.id, "No online request form is documented in ACP-RAP1.");
        }
        return needsReview(this.id, "An online request form is documented, but its authoritative role list is not available in the captured CAIRO responses.");
    }
};

export default ACP4;
