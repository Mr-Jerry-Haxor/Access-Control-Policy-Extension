import { getAnswerText } from "./utils.js";

const ACP28 = {
    id: "ACP28",
    name: "ACP28 Validation",
    category: "General",
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_RAP3 = getAnswerText(context, "ACP-RAP3");

        return `
Validate ACP28.

Requirement:
"ACP-RAP3: Describe this system/application's access validation process(both reconciliation and attestation as defined in the GCSSM 6.2) and the resulting artifacts as well as evidence of completion.
Checkpoint: Is the Account Validation process fully documented with step‑by‑step procedures that include clear details for every role?
Notes: Pass/Fail element checklist (all must be Yes to Pass this checkpoint)
• Who — identify the person who obtains the AS-IS user list. This person should be a member of one of the roles listed in the ACP AR1 section or can be listed as a resource for the application in ESATS.
• Where --  identify where account data and evidence of approvals are obtained and stored.
• How -- the access validation process must mention how the AS-IS user list is generated.
• How -- describe the step‑by‑step method how decisions are recorded.
• How -- show the approval and remediation workflow(who reviews results, how changes are enacted).
• How -- every role mentioned in Section ACP AR1 has a ""Access Validation"" process specified. This should include non-person identifiers (service accounts as well).
• All references to ""BASIC"" should be fixed/changed.

Recommended:
• How --  Identify how the SHOULD-BE list is generated. (This is actually a requirement, per policy.  But since many application teams cannot provide this information, it is not a part of the quality checklist at this time. Please incorporate into the access validation section if the application has their ""should-be"" list.)"

Answer context:
ACP-RAP3 Answer: \${ans_ACP_RAP3}

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

export default ACP28;
