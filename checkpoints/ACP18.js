import { buildAiValidationPrompt, buildReviewPrompt, getAnswerText, getNpiRows, rowValues, skip } from "./utils.js";

const REQUIREMENT = "When ACP-NPI1 is Yes, every NPI Function clearly explains the concrete action the identifier performs and what application-specific purpose, system, resource, or process it supports; ACP-NPI1 No is N/A.";

function formatNpiRowsForAi(context) {
    return getNpiRows(context).map(row => ({
        rowGroupNumber: String(row.rowGroupNumber ?? ""),
        nonPersonIdentifier: rowValues(row, "nonPersonIdentifier"),
        function: rowValues(row, "function"),
        nonPersonAccountOwner: rowValues(row, "nonPersonAccountOwner")
    }));
}

const ACP18 = {
    id: "ACP18",
    name: "NPI functions describe actions",
    category: "Non-Person Identifiers",
    type: "AI",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP18",
        requirement: REQUIREMENT,
        targetQuestion: "ACP-NPI1 Function",
        correction: "a clear, account-specific Function description for each deficient NPI, using only known purpose facts"
    }),
    buildPrompt(context) {
        const answer = getAnswerText(context, "ACP-NPI1").trim();
        if (/^no$/i.test(answer)) return null;
        return buildAiValidationPrompt({
            checkpointId: this.id,
            requirement: REQUIREMENT,
            decisionRules: "First inspect the ACP-NPI1 Yes/No answer. Return REVIEW if it is not an unambiguous Yes or No. ACP-NPI1 No is handled before AI and is not applicable. When ACP-NPI1 is Yes, evaluate every supplied NPI row separately. Each Function must explain what that specific non-person identifier is used for: it must state a concrete action the account performs and identify the application-specific purpose, system, resource, data flow, job, integration, or business/technical process affected. The mere presence of an action verb is not sufficient. FAIL blank values, placeholders, repetitions of the identifier name, or generic short descriptions such as service account, application use, automation, integration, system process, runs jobs, processes data, or similar wording that does not explain the actual use. Do not demand credentials, secrets, implementation minutiae, or unsupported details. FAIL if ACP-NPI1 is Yes but no NPI rows are supplied. PASS only when every row has a proper Function description. If any row fails, the reason, evidence, and recommendation must identify each deficient NPI by its nonPersonIdentifier or rowGroupNumber, explain which part is missing or too generic, and state what kind of action-and-purpose detail must be added. Do not invent the missing description or application facts.",
            evidence: {
                acpNpi1Answer: answer,
                nonPersonIdentifiers: formatNpiRowsForAi(context)
            }
        });
    },
    async validate(context) {
        const prompt = this.buildPrompt(context);
        return prompt ? { checkpointId: this.id, type: "AI", prompt } : skip(this.id, "ACP-NPI1 is No.");
    }
};

export default ACP18;
