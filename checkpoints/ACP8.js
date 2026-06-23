import { getAnswerText } from "./utils.js";

const ACP8 = {
    id: "ACP8",
    name: "ACP8 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");

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

export default ACP8;
