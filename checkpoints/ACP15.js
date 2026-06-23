import { getAnswerText } from "./utils.js";

const ACP15 = {
    id: "ACP15",
    name: "ACP15 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_NPI1 = getAnswerText(context, "ACP-NPI1");

        return `
Validate ACP15.

Requirement:
"ACP-NPI1:
Checkpoint: If an application is an internal web application or has a database, is there at least one non-person identifier account listed in the ACP? (If application isn't an internal web application or doesn't have a database, answer ""N/A"" to this checkpoint)"

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

export default ACP15;
