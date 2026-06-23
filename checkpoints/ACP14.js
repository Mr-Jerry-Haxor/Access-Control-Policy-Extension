import { skip } from "./utils.js";

const ACP14 = {
    id: "ACP14",
    name: "NPI Match via Risk Profiler",
    category: "Non-Person Identifiers",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "External data dependency (Risk Profiler API) not present.");
    }
};

export default ACP14;
