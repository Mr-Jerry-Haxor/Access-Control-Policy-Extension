import { getAnswerText } from "./utils.js";

const ACP23 = {
    id: "ACP23",
    name: "ACP23 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_RAP1 = getAnswerText(context, "ACP-RAP1");

        return `
Validate ACP23.

Requirement:
"ACP-RAP1: Describe your request, modify, removal\deactivate process.
Checkpoint: Is the Account Request process fully documented with step‑by‑step procedures that include clear details for every role?
Note: Pass/Fail element checklist(all must be Yes to Pass this checkpoint)
• Who — Each step names the role(s) or position(s) that perform the task.
• What — Each step describes the specific action or decision to be taken.
• How — Each step describes the method/tool/workflow used.(e.g: ticket ID, automation, MARS/IDAP, etc.)"

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

export default ACP23;
