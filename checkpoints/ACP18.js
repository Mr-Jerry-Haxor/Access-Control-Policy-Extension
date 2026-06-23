import { getAnswerText } from "./utils.js";

const ACP18 = {
    id: "ACP18",
    name: "ACP18 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context

        return `
Validate ACP18.

Requirement:
Checkpoint: If this system/application allows Non-US Persons to access any license export technical data like EAR LR and ITAR, is the ICP number and associated data populated to reflect the information contained in the ICP?(If the system/application does not allow Non-US Persons access to any license export technical data, the answer to this checkpoint should be "N/A").

Answer context:
Review the full context to determine this.

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

export default ACP18;
