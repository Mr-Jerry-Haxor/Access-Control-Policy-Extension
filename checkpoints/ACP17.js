import { getAnswerText } from "./utils.js";

const ACP17 = {
    id: "ACP17",
    name: "ACP17 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_NPI1 = getAnswerText(context, "ACP-NPI1");

        return `
Validate ACP17.

Requirement:
"ACP-NPI1:
Checkpoint: Were the Non-Person Account Owners active employees at the time of ACP review?"

Answer context:
ACP-NPI1 Answer: \${ans_ACP_NPI1}

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

export default ACP17;
