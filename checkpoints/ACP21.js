import { skip } from "./utils.js";

const ACP21 = {
    id: "ACP21",
    name: "Sensitive PII Match via Risk Profiler",
    category: "PII Access Rules",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "External data dependency (Risk Profiler API) not present.");
    }
};

export default ACP21;
