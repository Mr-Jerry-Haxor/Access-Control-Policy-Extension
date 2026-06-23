import { getAnswerText } from "./utils.js";

const ACP11 = {
    id: "ACP11",
    name: "ACP11 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");

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
\`;
    },
    async validate(context) {
        return {
            checkpointId: this.id,
            type: "AI",
            prompt: this.buildPrompt(context)
        };
    }
};

export default ACP11;
