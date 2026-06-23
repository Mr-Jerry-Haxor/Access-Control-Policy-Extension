import { getAnswerText } from "./utils.js";

const ACP14 = {
    id: "ACP14",
    name: "ACP14 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_NPI1 = getAnswerText(context, "ACP-NPI1");
        const ans_CSIR_SvcAcct = getAnswerText(context, "CSIR-SvcAcct");

        return `
Validate ACP14.

Requirement:
"ACP-NPI1:
Checkpoint: Does the Non-person identifier(ACP-NPI1) in ACP match with the (CSIR-SvcAcct) in Risk Profiler?"

Answer context:
ACP-NPI1 Answer: \${ans_ACP_NPI1}
CSIR-SvcAcct Answer: \${ans_CSIR_SvcAcct}

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

export default ACP14;
