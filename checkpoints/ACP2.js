import { fail, getAnswerText, pass } from "./utils.js";

const ACP2 = {
    id: "ACP2",
    name: "Application functionality statement",
    category: "Application Description",
    type: "RULE",
    async validate(context) {
        const text = getAnswerText(context, "ACP-AA1").trim();
        if (!text || /^(n\/?a|none|not applicable)$/i.test(text)) {
            return fail(this.id, "ACP-AA1 does not contain a functionality statement.");
        }
        return pass(this.id, "ACP-AA1 contains a functionality statement.");
    }
};

export default ACP2;
