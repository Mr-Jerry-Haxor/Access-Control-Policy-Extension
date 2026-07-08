import { fail, getAnswerText, pass, skip } from "./utils.js";

const ACP18 = {
    id: "ACP18",
    name: "ICP Data Match",
    category: "Export Compliance",
    type: "RULE",
    async validate(context) {
        const nonUsAccess = getAnswerText(context, "ACP-EXPORT-NON-US");
        if (!/^yes$/i.test(nonUsAccess.trim())) {
            return skip(this.id, "ACP-EXPORT-NON-US is not Yes.");
        }

        const exportData = getAnswerText(context, "ACP-EXPORT-1");
        const hasControlledData = /EAR|ITAR/i.test(exportData);
        if (!hasControlledData) {
            return skip(this.id, "No EAR LR or ITAR export data selection was found.");
        }

        const icpText = getAnswerText(context, "ACP-EXPORT-OPT");
        return /ICP|export authorization|license/i.test(icpText)
            ? pass(this.id, "Export-controlled non-US access is documented with authorization/ICP context.")
            : fail(this.id, "Non-US access to EAR LR/ITAR data is indicated, but ICP/export authorization details were not found.");
    }
};

export default ACP18;
