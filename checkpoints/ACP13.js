import { getAnswerText } from "./utils.js";

const ACP13 = {
    id: "ACP13",
    name: "ACP13 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");

        return `
Validate ACP13.

Requirement:
"ACP-AR1:
Checkpoint: If the ""Responsibility"" section of a role states what type of access a role has, does it match the appropriate Access Level(Database, Server, and Application) selection?

Note: For example, if the responsibility of a role states that the role has ""read"" access to the application, then the ""Access to Application"" must have ""Read"" selected.  If the responsibility section of all the roles does not state the level of access, then ""N/A"" should be selected."

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

export default ACP13;
