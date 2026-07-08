import { skip } from "./utils.js";

const ACP22 = {
    id: "ACP22",
    name: "GPO Registration Match",
    category: "PII Access Rules",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "GPO/1PIA registration lookup endpoint was not present in cairo.har.");
    }
};

export default ACP22;
