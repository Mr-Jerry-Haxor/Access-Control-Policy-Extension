import { fail, getDatabaseApproverRows, hasRoleMatching, pass, skip } from "./utils.js";

const ACP5 = {
    id: "ACP5",
    name: "DBA Role Validation via CMDB",
    category: "Access Roles",
    type: "RULE",
    async validate(context) {
        const databaseApprovers = getDatabaseApproverRows(context);
        const hasDatabaseEvidence = databaseApprovers.length > 0 || hasRoleMatching(context, /\bDBA\b|database administrator/i);

        if (!hasDatabaseEvidence) {
            return skip(this.id, "CMDB database inventory endpoint was not present in cairo.har, and no CAIRO database approver/DBA evidence was found.");
        }

        return hasRoleMatching(context, /\bDBA\b|database administrator/i)
            ? pass(this.id, "Database evidence exists and ACP-AR1 includes a DBA role.")
            : fail(this.id, "Database evidence exists, but ACP-AR1 does not include a DBA role.");
    }
};

export default ACP5;
