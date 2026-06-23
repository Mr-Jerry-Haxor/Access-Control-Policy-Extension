import {
    getAnswerText
}
from "./utils.js";

const ACP28 = {

    id: "ACP28",

    name: "Access Validation Process",

    category: "Validation",

    type: "AI",

    buildPrompt(context) {

        return `
Validate ACP28.

Answer:

${getAnswerText(context, "ACP28")}

Return JSON:

{
  "status":"PASS|FAIL",
  "reason":"..."
}
`;
    },

    async validate(context) {

        return {

            checkpointId:
                this.id,

            type:
                "AI",

            prompt:
                this.buildPrompt(
                    context
                )
        };
    }
};

export default ACP28;