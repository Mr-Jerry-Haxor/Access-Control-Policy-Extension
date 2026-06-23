import { skip } from "./utils.js";

const ACP5 = {
    id: "ACP5",
    name: "DBA Role Validation via CMDB",
    category: "Access Roles",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "External data dependency (CMDB API) not present.");
    }
};

export default ACP5;
