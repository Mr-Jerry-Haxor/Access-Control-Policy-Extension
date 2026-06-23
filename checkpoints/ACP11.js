import { getAnswerText, skip } from "./utils.js";

const ACP11 = {
    id: "ACP11",
    name: "ACP11 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");
        if (!ans_ACP_AR1 || !ans_ACP_AR1.trim()) return null;

        return `
Validate ACP11.

Requirement:
"ACP-AR1:
Checkpoint: Does the Authorized Entity statement (or other statements in the ACP, such as the description, processes, and additional information) not conflict with the Person Status or Person Type for the role? 
Exception: If the conflict cannot be validated, answer 'N/A'.

Note:
• References to Compute 2.0, Enterprise Compute Program, Dell, TCS, HCL, Tech M, would all be considered to be Purchased Services.  (Included, but not limited to.)
• The BLEAT! tool can be used to verify users' person types:  https://library.web.boeing.com/apps/bleat/"

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

export default ACP11;
