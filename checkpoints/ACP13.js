import { getAnswerText, skip } from "./utils.js";

const ACP13 = {
    id: "ACP13",
    name: "ACP13 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");
        if (!ans_ACP_AR1 || !ans_ACP_AR1.trim()) return null;

        return `
Validate ACP13.

Requirement:
"ACP-AR1:
Checkpoint: If the ""Responsibility"" section of a role states what type of access a role has, does it match the appropriate Access Level(Database, Server, and Application) selection?

Note: For example, if the responsibility of a role states that the role has ""read"" access to the application, then the ""Access to Application"" must have ""Read"" selected.  If the responsibility section of all the roles does not state the level of access, then ""N/A"" should be selected."

Answer context:
ACP-AR1 Answer: ${ans_ACP_AR1}

Return JSON only:
{
    "status": "PASS|FAIL|WARNING",
    "reason": "..."
}
`;
    },
    async validate(context) {
        const prompt = this.buildPrompt(context);
        // Basic check if the prompt ended up with empty answers (assuming the prompt format puts the answer at the end)
        // A better way: if prompt is null, skip. So we will just add a check:
        if (!prompt) return skip(this.id, "Missing required data for AI prompt.");
        
        // Also check if the prompt's injected answers are empty.
        // Usually it says "Answer: ${ans_...}". If it's just "Answer: " or "Answer: \n", it's missing.
        // We will just do a generic check or modify buildPrompt.
        return {
            checkpointId: this.id,
            type: "AI",
            prompt
        };
    }
};

export default ACP13;
