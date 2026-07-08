import { getAnswerText, skip } from "./utils.js";

const ACP26 = {
    id: "ACP26",
    name: "ACP26 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_RAP1 = getAnswerText(context, "ACP-RAP1");
        if (!ans_ACP_RAP1 || !ans_ACP_RAP1.trim()) return null;

        return `
Validate ACP26.

Requirement:
"ACP-RAP1: Describe your request, modify, removal\deactivate process
Checkpoint: Does the access removal process not include elements of the access validation process?
Note: The access removal process does not include elements of the access validation, but is used as part of removing accounts from the results of performing an access validation. In other words, the access validation can refer to the access removal process, but it shouldn't be part of it."
	Describe your approval process

Answer context:
ACP-RAP1 Answer: ${ans_ACP_RAP1}

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

export default ACP26;
