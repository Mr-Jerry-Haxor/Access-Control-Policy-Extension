import { getAnswerText } from "./utils.js";

const ACP5 = {
    id: "ACP5",
    name: "ACP5 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");

        return `
Validate ACP5.

Requirement:
"ACP-AR1:
Checkpoint: If the application has a database listed in CMDB(and is not identified as cloud/container application), does the ACP have a DBA role? 
Notes:
 • If there are no databases, answer ""N/A"".  
 • If the databases were incorrectly associated with the application and the application really doesn't have a database, then this question can be answered ""N/A"" as long as the situation is described in the additional information section of the ACP.)"

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

export default ACP5;
