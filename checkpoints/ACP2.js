import { getAnswerText } from "./utils.js";

const ACP2 = {
    id: "ACP2",
    name: "ACP2 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AA1 = getAnswerText(context, "ACP-AA1");

        return `
Validate ACP2.

Requirement:
"ACP-AA1: Describe the functionality of the application and the business functions it performs.
Checkpoint: Is there a statement of the functionality of the application?"

Answer context:
ACP-AA1 Answer: \${ans_ACP_AA1}

Return JSON only:
{
    "status": "PASS|FAIL|WARNING",
    "reason": "..."
}
`;
    },
    async validate(context) {
        return {
            checkpointId: this.id,
            type: "AI",
            prompt: this.buildPrompt(context)
        };
    }
};

export default ACP2;
