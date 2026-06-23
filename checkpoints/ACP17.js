import { skip } from "./utils.js";

const ACP17 = {
    id: "ACP17",
    name: "Account Owner Active Status",
    category: "Non-Person Identifiers",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "External data dependency (Active Directory API) not present.");
    }
};

export default ACP17;
