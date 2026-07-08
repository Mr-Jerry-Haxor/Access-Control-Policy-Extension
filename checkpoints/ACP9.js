import { skip } from "./utils.js";

const ACP9 = {
    id: "ACP9",
    name: "Developer Role Validation via Risk Profiler",
    category: "Access Roles",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "Risk Profiler CSIR-IPOwner endpoint was not present in cairo.har.");
    }
};

export default ACP9;
