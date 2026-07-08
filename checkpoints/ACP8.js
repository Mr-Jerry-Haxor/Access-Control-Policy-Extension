import { getAnswerText, skip } from "./utils.js";

const ACP8 = {
    id: "ACP8",
    name: "ACP8 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");
        if (!ans_ACP_AR1 || !ans_ACP_AR1.trim()) return null;

        return `
Validate ACP8.

Requirement:
"ACP-AR1:
Checkpoint: Does each access role listed in the ACP have responsibilities documented for the actions performed by the role?(The responsibilities must state work tasks performed.)
Notes: 
• Documented actions must be comensurate to the role title.
• If people are separated by different roles in ESATS, they should be separate roles in the ACP(for example Developer and Tier 2/3 support.)
• If there is any information in the Additional Information section of the ACP explaining the absence of responsibilities by the application team's request, answer “N/A""."

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

export default ACP8;
