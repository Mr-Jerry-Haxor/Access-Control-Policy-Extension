import { skip } from "./utils.js";

const ACP17 = {
    id: "ACP17",
    name: "Account Owner Active Status",
    category: "Non-Person Identifiers",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "NPI account owner table was not present in ; CED lookups are available only for collected BEMS IDs such as database approvers.");
    }
};

export default ACP17;
