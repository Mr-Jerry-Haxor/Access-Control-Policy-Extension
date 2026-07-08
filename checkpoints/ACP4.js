import { skip } from "./utils.js";

const ACP4 = {
    id: "ACP4",
    name: "Online Request Form Roles Match",
    category: "Access Roles",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "STAR/MARS online request-form endpoints were not present in cairo.har.");
    }
};

export default ACP4;
