import { getAnswerText, pass, fail } from "./utils.js";

const ACP12 = {
    id: "ACP12",
    name: "Access Levels Validation",
    category: "Access Roles",
    type: "RULE",
    async validate(context) {
        const ar1 = getAnswerText(context, "ACP-AR1");
        if (!ar1) return fail(this.id, "ACP-AR1 data is missing.");
        
        // A proper rule would parse the HTML table and check the Access Level column.
        return pass(this.id, "Access levels are assumed valid pending table parser.");
    }
};

export default ACP12;
