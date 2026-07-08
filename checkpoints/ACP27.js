import { getAnswerText, skip } from "./utils.js";

const ACP27 = {
    id: "ACP27",
    name: "ACP27 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_RAP2 = getAnswerText(context, "ACP-RAP2");
        if (!ans_ACP_RAP2 || !ans_ACP_RAP2.trim()) return null;

        return `
Validate ACP27.

Requirement:
"ACP-RAP2: Describe your approval process
Checkpoint: Does every role listed in Section ACP AR1 have a step-by-step process which can be performed by a person who is approving/processing access to the application?"
	Describe the system/applications access validation process

Answer context:
ACP-RAP2 Answer: ${ans_ACP_RAP2}

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

export default ACP27;
