import { skip } from "./utils.js";

const ACP6 = {
    id: "ACP6",
    name: "DBA Person Type Match via CMDB",
    category: "Access Roles",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "External data dependency (CMDB API) not present.");
    }
};

export default ACP6;
