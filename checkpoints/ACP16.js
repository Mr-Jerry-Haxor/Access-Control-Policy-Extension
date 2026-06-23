import { getAnswerText } from "./utils.js";

const ACP16 = {
    id: "ACP16",
    name: "ACP16 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_NPI1 = getAnswerText(context, "ACP-NPI1");

        return `
Validate ACP16.

Requirement:
"ACP-NPI1:
Checkpoint: Do all Non-Person Identifiers describe the functions that the non-person identifiers perform in the ""Function"" section of the Non-Person Identifiers table?
Note: The description must include an action that each of the non-person identifiers perform."

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

export default ACP16;
