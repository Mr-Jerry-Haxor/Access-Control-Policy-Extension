import { skip } from "./utils.js";

const ACP9 = {
    id: "ACP9",
    name: "Developer Role Validation via Risk Profiler",
    category: "Access Roles",
    type: "RULE",
    async validate(context) {
        return skip(this.id, "External data dependency (Risk Profiler API) not present.");
    }
};

export default ACP9;
