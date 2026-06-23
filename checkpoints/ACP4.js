import { skip } from "./utils.js";

const ACP4 = {
    id: "ACP4",
    name: "Online Request Form Roles Match",
    category: "Access Roles",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "External data dependency (STAR/MARS API) not present.");
    }
};

export default ACP4;
