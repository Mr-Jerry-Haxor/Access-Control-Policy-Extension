import { buildReviewPrompt, fail, formatRoleRowsForAi, getAnswerText, needsReview, skip } from "./utils.js";

function controlledNonUsRoles(context) {
    return formatRoleRowsForAi(context).filter(row =>
        row.personStatus.some(value => /non[- ]?us person/i.test(value)) &&
        row.dataType.some(value => /EAR(?!.*NLR)|ITAR|license required|export controlled/i.test(value) && !/NLR|not license required/i.test(value))
    );
}

const ACP20 = {
    id: "ACP20",
    name: "ICP data matches current authorization",
    category: "Export Compliance",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP20",
        requirement: "For licensed export data accessible to Non-US Persons, the ICP number and all ACP-EXPORT-1 fields match the current ICP.",
        targetQuestion: "ACP-EXPORT-1",
        correction: "the exact missing or mismatched ICP fields; never fabricate an ICP identifier"
    }),
    async validate(context) {
        const roles = controlledNonUsRoles(context);
        const explicitNonUs = /^yes$/i.test(getAnswerText(context, "ACP-EXPORT-NON-US").trim());
        if (!roles.length && !explicitNonUs) return skip(this.id, "No Non-US access to licensed export-controlled data is indicated.");
        const exportQuestion = context.normalizedQuestionMap?.get("ACP-EXPORT-1");
        const hasRows = !!exportQuestion?.table?.rows?.length;
        const answer = getAnswerText(context, "ACP-EXPORT-1");
        if (!hasRows && !answer) return fail(this.id, "Licensed Non-US export access is indicated, but ACP-EXPORT-1 has no ICP data.");
        return needsReview(this.id, "ACP export/ICP data is present, but the authoritative current ICP record is not available in the captured responses for field-by-field verification.");
    }
};

export default ACP20;
