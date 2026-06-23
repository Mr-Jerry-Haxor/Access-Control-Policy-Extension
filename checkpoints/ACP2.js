import { getAnswerText, pass, fail } from "./utils.js";

const ACP2 = {
    id: "ACP2",
    name: "Application Functionality Statement",
    category: "General",
    type: "RULE",
    async validate(context) {
        const text = getAnswerText(context, "ACP-AA1");
        if (text && text.trim().length > 0) {
            return pass(this.id, "Functionality statement is present.");
        }
        return fail(this.id, "No functionality statement found for ACP-AA1.");
    }
};

export default ACP2;
