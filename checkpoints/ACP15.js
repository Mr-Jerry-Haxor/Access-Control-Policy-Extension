import { fail, getAnswerText, getDatabaseApproverRows, hasRoleMatching, pass, skip } from "./utils.js";

const ACP15 = {
    id: "ACP15",
    name: "NPI Database Requirement via CMDB",
    category: "Non-Person Identifiers",
    type: "RULE",
    async validate(context) {
        const hasDatabaseEvidence = getDatabaseApproverRows(context).length > 0 || hasRoleMatching(context, /\bDBA\b|database administrator/i);
        const appRecord = (context.supportingData?.esatsBusapp || [])[0] || {};
        const isInternalWebApp = /internal web/i.test(`${appRecord.baAppTypeCategory || ""} ${appRecord.description || ""}`);

        if (!hasDatabaseEvidence && !isInternalWebApp) {
            return skip(this.id, "CMDB database inventory endpoint was not present in , and CAIRO did not show database/internal-web evidence.");
        }

        const npiAnswer = getAnswerText(context, "ACP-NPI1");
        return /^yes$/i.test(npiAnswer.trim())
            ? pass(this.id, "Database/internal-web evidence exists and ACP-NPI1 is Yes.")
            : fail(this.id, "Database/internal-web evidence exists, but ACP-NPI1 is not Yes.");
    }
};

export default ACP15;
