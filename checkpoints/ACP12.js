import { getAnswerText } from "./utils.js";

const ACP12 = {
    id: "ACP12",
    name: "ACP12 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");

        return `
Validate ACP12.

Requirement:
"ACP-AR1:
Checkpoint: Do all of the roles have at least one Access Level listed as something other than 'None'? 
Note: All of the Access Levels(Database, Server, and Application) cannot be answered 'None'.  No access could be provisioned for a role with no access to the Database, Server, or Application."

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

export default ACP12;
