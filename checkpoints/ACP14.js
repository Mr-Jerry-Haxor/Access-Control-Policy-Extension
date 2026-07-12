import { skip } from "./utils.js";

const ACP14 = {
    id: "ACP14",
    name: "NPI Match via Risk Profiler",
    category: "Non-Person Identifiers",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "Risk Profiler CSIR-SvcAcct endpoint was not present in .");
    }
};

export default ACP14;
