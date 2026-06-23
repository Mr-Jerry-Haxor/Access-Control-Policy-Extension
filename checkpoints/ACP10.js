import { getAnswerText } from "./utils.js";

const ACP10 = {
    id: "ACP10",
    name: "ACP10 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_AR1 = getAnswerText(context, "ACP-AR1");

        return `
Validate ACP10.

Requirement:
"ACP-AR1:
Checkpoint: Does each access role listed in the Access Role section have an Authorized Entity defined with a definable group of people who can have access to the role?
Notes:
 • Does the Authorized Entity for the (Non-Boeing) Developer and (Non-Boeing) Support role match with the Division, Program, Sub Program, and Department Name of the Sponsor in Insite?
 • Does the Authorized Entity for the (Boeing) Developer and (Boeing) Support role match with their Division, Program, Sub Program, and Department Name in Insite?
 • For other roles - Is it a definable group of people?
 • If App teams want to use their team name - ASA should note it down in the Additional Information section
 • Authorized entity can be defined using AD Groups, Project Name, Product name, Attributes, Person Types.
 • Authorized entity cannot reference role name as entity group(circular argument).
 • Authentication methods should not be referenced for authorized entities.(e.g. SecureBadge is used for authentication only, WSSO uses authentication methods like SecureBadge to provide authorization.)"

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

export default ACP10;
