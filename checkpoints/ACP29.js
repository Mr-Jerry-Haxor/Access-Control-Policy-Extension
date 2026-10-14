import { ADDITIONAL_INFORMATION_EXCEPTION_RULES, buildAiValidationPrompt, buildReviewPrompt, formatRoleRowsForAi, getAdditionalInformation, getAnswerText, getNpiRows, skip, values } from "./utils.js";

const REQUIREMENT = "ACP-RAP3 fully documents reconciliation and attestation with Who, Where, AS-IS generation, decision recording, approval/remediation workflow, every ACP-AR1 role, every NPI, and no BASIC references; SHOULD-BE generation is recommended.";

function formattedNpis(context) {
    return getNpiRows(context).map(row => ({
        rowGroupNumber: String(row.rowGroupNumber ?? ""),
        nonPersonIdentifier: values(row.nonPersonIdentifier),
        function: values(row.function),
        nonPersonAccountOwner: values(row.nonPersonAccountOwner)
    }));
}

const ACP29 = {
    id: "ACP29", name: "Access validation process completeness", category: "Access Validation", type: "AI",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP29", requirement: REQUIREMENT, targetQuestion: "ACP-RAP3 and ACP-AI2",
        correction: "a complete numbered replacement process covering each exact role and NPI, preserving evidence and marking unknown locations, actors, and tools with placeholders"
    }),
    buildPrompt(context) {
        const process = getAnswerText(context, "ACP-RAP3");
        const additionalInformation = getAdditionalInformation(context);
        if (!process.trim() && !additionalInformation.trim()) return null;
        return buildAiValidationPrompt({
            checkpointId: this.id, requirement: REQUIREMENT,
            decisionRules: `All mandatory elements must be evidenced for PASS. The AS-IS owner must be an ACP role or evidenced ESATS resource; an ESATS-only role must be identified as per ESATS. NPI validation is mandatory from November 2026; before then report its absence as REVIEW, not FAIL. SHOULD-BE generation is recommended and must not alone cause FAIL. ${ADDITIONAL_INFORMATION_EXCEPTION_RULES}`,
            evidence: {
                accessRoles: formatRoleRowsForAi(context),
                nonPersonIdentifiers: formattedNpis(context),
                accessValidation: process,
                esatsRoleTypes: (context.supportingData?.esatsRoles || []).map(role => role.roleType || role.sourceContactType).filter(Boolean),
                assessmentDate: context.detail?.actualStartOn || context.detail?.initiatedOn || null,
                additionalInformationQuestion: "ACP-AI2",
                additionalInformation
            }
        });
    },
    async validate(context) { const prompt = this.buildPrompt(context); return prompt ? { checkpointId: this.id, type: "AI", prompt } : skip(this.id, "ACP-RAP3 and ACP-AI2 are missing."); }
};
export default ACP29;
