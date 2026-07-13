import { getAnswerText, skip } from "./utils.js";

const ACP24 = {
    id: "ACP24",
    name: "ACP24 Validation",
    category: "General",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "AI",
    buildPrompt(context) {
        // Gather answers from context
        const ans_ACP_RAP1 = getAnswerText(context, "ACP-RAP1");
        if (!ans_ACP_RAP1 || !ans_ACP_RAP1.trim()) return null;

        return `
Validate ACP24.

Requirement:
"ACP-RAP1: Describe your request, modify, removal\deactivate process.
Checkpoint: Is the Account Modify process fully documented with step‑by‑step procedures that include clear details for every role?
Note: Pass/Fail element checklist(all must be Yes to Pass this checkpoint)
• Who — Each step names the role(s) or position(s) that perform the task.
• What — Each step describes the specific action or decision to be taken.
• How — Each step describes the method/tool/workflow used. (e.g: ticket ID, automation, MARS/IDAP, etc.)"

Answer context:
ACP-RAP1 Answer: ${ans_ACP_RAP1}

Return JSON only:
{
    "status": "PASS|FAIL|WARNING",
    "reason": "..."
}
`;
    },
    async validate(context) {
        const prompt = this.buildPrompt(context);
        // Basic check if the prompt ended up with empty answers (assuming the prompt format puts the answer at the end)
        // A better way: if prompt is null, skip. So we will just add a check:
        if (!prompt) return skip(this.id, "Missing required data for AI prompt.");
        
        // Also check if the prompt's injected answers are empty.
        // Usually it says "Answer: ${ans_...}". If it's just "Answer: " or "Answer: \n", it's missing.
        // We will just do a generic check or modify buildPrompt.
        return {
            checkpointId: this.id,
            type: "AI",
            prompt
        };
    }
};

export default ACP24;
