import { getAnswerText } from "./utils.js";

const ACP7 = {
    id: "ACP7",
    name: "ACP7 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");

        return `
Validate ACP7.

Requirement:
"ACP-AR1:
Checkpoint: Is there an application support role documented in the ACP if the application has the ""Tier 2/3 Technical Support"" role populated in ESATS?
Notes: If there isn't a Tier 2/3 Technical Support roles populated in ESATS, answer ""N/A"""

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

export default ACP7;
