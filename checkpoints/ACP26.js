import { getAnswerText } from "./utils.js";

const ACP26 = {
    id: "ACP26",
    name: "ACP26 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_RAP1 = getAnswerText(context, "ACP-RAP1");

        return `
Validate ACP26.

Requirement:
"ACP-RAP1: Describe your request, modify, removal\deactivate process
Checkpoint: Does the access removal process not include elements of the access validation process?
Note: The access removal process does not include elements of the access validation, but is used as part of removing accounts from the results of performing an access validation. In other words, the access validation can refer to the access removal process, but it shouldn't be part of it."
	Describe your approval process

Answer context:
ACP-RAP1 Answer: \${ans_ACP_RAP1}

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

export default ACP26;
