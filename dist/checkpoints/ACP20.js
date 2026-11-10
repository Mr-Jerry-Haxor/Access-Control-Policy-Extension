import { fail, formatRoleRowsForAi, getAnswerText, needsReview, skip } from "./utils.js";

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
