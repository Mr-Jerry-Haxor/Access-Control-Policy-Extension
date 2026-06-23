import { skip } from "./utils.js";

const ACP7 = {
    id: "ACP7",
    name: "Tier 2/3 Tech Support via ESATS",
    category: "Access Roles",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "External data dependency (ESATS API) not present.");
    }
};

export default ACP7;
