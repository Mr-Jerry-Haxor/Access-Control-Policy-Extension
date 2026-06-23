import { getAnswerText } from "./utils.js";

const ACP4 = {
    id: "ACP4",
    name: "ACP4 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");

        return `
Validate ACP4.

Requirement:
"ACP-AR1
Checkpoint: Do the documented roles match the roles found in an available online request form for the application?
Notes:
 • This could include STAR, MARS, or any other online form as documented in the Request/Approval/Removal section of the ACP.
 • The role names in the online request form must match the role names in the ACP.
 • If there is not an online form documented in the Request/Approval/Removal section of the ACP, answer ""N/A"".
 • If there is information in the Additional Information Section of the ACP explaining the differences, answer “N/A”.
 • If the online form has changed since the approval of the ACP, answer “N/A”.(This can be validated by communicating with the application team.)
 • Any non-online request form used, answer “N/A”."

Answer context:
ACP-AR1 Answer: \${ans_ACP_AR1}

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

export default ACP4;
