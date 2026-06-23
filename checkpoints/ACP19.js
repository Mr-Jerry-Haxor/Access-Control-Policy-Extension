import { getAnswerText } from "./utils.js";

const ACP19 = {
    id: "ACP19",
    name: "ACP19 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");

        return `
Validate ACP19.

Requirement:
Checkpoint: For every role in ACP-AR1 that has Person Status set to "Non-US Person", is the data type "US Export - Not Yet Determined" not selected? (If there aren't Non-US Persons in the application, select "N/A").

Answer context:
ACP-AR1 Answer: \${ans_ACP_AR1}

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

export default ACP19;
