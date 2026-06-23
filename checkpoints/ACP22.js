import { skip } from "./utils.js";

const ACP22 = {
    id: "ACP22",
    name: "GPO Registration Match",
    category: "PII Access Rules",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "External data dependency (GPO System API) not present.");
    }
};

export default ACP22;
