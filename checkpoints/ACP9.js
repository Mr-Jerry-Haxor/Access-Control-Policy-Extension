import { getAnswerText } from "./utils.js";

const ACP9 = {
    id: "ACP9",
    name: "ACP9 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");
        const ans_CSIR_IPOwner = getAnswerText(context, "CSIR-IPOwner");

        return `
Validate ACP9.

Requirement:
"ACP-AR1:
Checkpoint:  If ""Boeing"" is selected in the Risk Profiler's CSIR-IPOwner question, is a developer role listed in the Access Roles section of the application ACP?
Notes: 
• Answer ""N/A"" for non-Boeing owned applications."

Answer context:
ACP-AR1 Answer: \${ans_ACP_AR1}
CSIR-IPOwner Answer: \${ans_CSIR_IPOwner}

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

export default ACP9;
