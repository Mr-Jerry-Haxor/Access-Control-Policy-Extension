import { fail, needsReview, pass } from "./utils.js";

const ACP17 = {
    id: "ACP17",
    name: "Account Owner Active Status",
    category: "Non-Person Identifiers",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        const rows = context.supportingData?.questionTables?.['ACP-NPI1']?.rows || [];
        const ownerIds = [...new Set(rows.flatMap(row => Object.entries(row)
            .filter(([key]) => /owner|bems/i.test(key))
            .flatMap(([, value]) => Array.isArray(value) ? value : [value])
            .map(String)
            .filter(value => /^\d{3,}$/.test(value))))];
        if (!ownerIds.length) return needsReview(this.id, "No NPI owner BEMS IDs were available for authoritative status verification.");

        const records = ownerIds.map(id => ({ id, record: (context.supportingData?.cedPublic?.[id] || [])[0] }));
        const missing = records.filter(item => !item.record);
        if (missing.length) return needsReview(this.id, `CED evidence was unavailable for NPI owner(s): ${missing.map(item => item.id).join(', ')}.`);
        const inactive = records.filter(item => String(item.record.status).toUpperCase() !== 'A');
        return inactive.length
            ? fail(this.id, `Inactive NPI owner(s): ${inactive.map(item => item.id).join(', ')}.`)
            : pass(this.id, `All ${records.length} NPI owner(s) have active CED status.`);
    }
};

export default ACP17;
