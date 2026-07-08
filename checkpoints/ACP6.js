import { getDatabaseApproverRows, skip } from "./utils.js";

const ACP6 = {
    id: "ACP6",
    name: "DBA Person Type Match via CMDB",
    category: "Access Roles",
    type: "RULE",
    async validate(context) {
        if (getDatabaseApproverRows(context).length === 0) {
            return skip(this.id, "CMDB DBA inventory endpoint was not present in cairo.har, and ACP-RAP4 database approvers were not found.");
        }
        return skip(this.id, "CMDB DBA person-type data was not present in cairo.har; CAIRO only exposed ACP-RAP4 database approver BEMS IDs.");
    }
};

export default ACP6;
