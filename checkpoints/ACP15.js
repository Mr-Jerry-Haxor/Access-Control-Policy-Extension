import { skip } from "./utils.js";

const ACP15 = {
    id: "ACP15",
    name: "NPI Database Requirement via CMDB",
    category: "Non-Person Identifiers",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "External data dependency (CMDB API) not present.");
    }
};

export default ACP15;
