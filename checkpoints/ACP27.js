import { getAnswerText } from "./utils.js";

const ACP27 = {
    id: "ACP27",
    name: "ACP27 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_RAP2 = getAnswerText(context, "ACP-RAP2");

        return `
Validate ACP27.

Requirement:
"ACP-RAP2: Describe your approval process
Checkpoint: Does every role listed in Section ACP AR1 have a step-by-step process which can be performed by a person who is approving/processing access to the application?"
	Describe the system/applications access validation process

Answer context:
ACP-RAP2 Answer: \${ans_ACP_RAP2}

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

export default ACP27;
