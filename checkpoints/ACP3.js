import { getAnswerText } from "./utils.js";

const ACP3 = {
    id: "ACP3",
    name: "ACP3 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");

        return `
Validate ACP3.

Requirement:
"ACP-AR1:
Checkpoint: Do the documented roles match the roles listed in the ""Request/Approval/Removal"" section of the ACP?"

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

export default ACP3;
