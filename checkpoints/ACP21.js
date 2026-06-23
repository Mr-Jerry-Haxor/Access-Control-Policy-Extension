import { getAnswerText } from "./utils.js";

const ACP21 = {
    id: "ACP21",
    name: "ACP21 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_PIIAR2 = getAnswerText(context, "ACP-PIIAR2");
        const ans_CSIR_Data = getAnswerText(context, "CSIR-Data");

        return `
Validate ACP21.

Requirement:
"ACP-PIIAR2: Will the application process or grant access to Highly Sensitive PII, European Union PII, other regulated PII, or sensitive Personally Identifiable Information?
Checkpoint: If ""CSIR-Data"" in Risk Profiler, has PII other than just NSPII(Highly Sensitive PII, Sensitive PII, or Regulated PII) selected, is ACP-PIIAR2 marked as ""Yes""?"

Answer context:
ACP-PIIAR2 Answer: \${ans_ACP_PIIAR2}
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

export default ACP21;
