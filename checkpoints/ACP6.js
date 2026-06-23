import { getAnswerText } from "./utils.js";

const ACP6 = {
    id: "ACP6",
    name: "ACP6 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");

        return `
Validate ACP6.

Requirement:
"ACP-AR1:
Checkpoint: If the application has a database listed in CMDB(and is not identified as cloud/container application), does the ""Person Type"" in the DBA role match the Person Type for any DBA associated with the application in CMDB?"

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

export default ACP6;
