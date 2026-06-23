import {
    pass,
    fail,
    getAnswerText
}
from "./utils.js";

const ACP2 = {

    id: "ACP2",

    name: "Application Functionality",

    category: "Description",

    type: "AI",

    buildPrompt(context) {

        const answer =

            getAnswerText(
                context,
                "ACP2"
            );

        return `
Validate ACP2.

Requirement:

Determine if the response clearly
describes:

1. Application functionality.

2. Business functions.

Answer:

${answer}

Return JSON only:

{
    "status":"PASS|FAIL",
    "reason":"..."
}
`;
    },

    async validate(context) {

        const prompt =
            this.buildPrompt(
                context
            );

        return {

            checkpointId:
                this.id,

            type:
                "AI",

            prompt
        };
    }
};

export default ACP2;