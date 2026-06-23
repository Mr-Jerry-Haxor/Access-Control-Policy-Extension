import { skip } from "./utils.js";

const ACP18 = {
    id: "ACP18",
    name: "ICP Data Match",
    category: "Export Compliance",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "External data dependency (ICP Data) not present.");
    }
};

export default ACP18;
