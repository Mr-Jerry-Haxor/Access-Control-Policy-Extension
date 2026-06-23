import { getAnswerText } from "./utils.js";

const ACP20 = {
    id: "ACP20",
    name: "ACP20 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_PIIAR1 = getAnswerText(context, "ACP-PIIAR1");
        const ans_CSIR_Data = getAnswerText(context, "CSIR-Data");

        return `
Validate ACP20.

Requirement:
"ACP-PIIAR1: Will the application process or grant access to any Personally Identifiable Information (PII)? 
Checkpoint: Does the answer to ACP-PIIAR1 match with any PII selected data types (CSIR-Data) in Risk Profiler?"

Answer context:
ACP-PIIAR1 Answer: \${ans_ACP_PIIAR1}
CSIR-Data Answer: \${ans_CSIR_Data}

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

export default ACP20;
