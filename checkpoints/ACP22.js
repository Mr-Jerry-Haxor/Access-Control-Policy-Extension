import { getAnswerText } from "./utils.js";

const ACP22 = {
    id: "ACP22",
    name: "ACP22 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_PIIAR3 = getAnswerText(context, "ACP-PIIAR3");

        return `
Validate ACP22.

Requirement:
"ACP-PIIAR3: Have you registered your system with the Global Privacy Office? 
Checkpoint: If marked ‘Yes’, does the number provided for ACP-PIIAR3 match in the GPO website? (""N/A"" if marked 'No'.)
Note: DPAR will be replaced by 1PIA in 2026."

Answer context:
ACP-PIIAR3 Answer: \${ans_ACP_PIIAR3}

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

export default ACP22;
