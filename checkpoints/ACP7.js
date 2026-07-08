import { fail, hasRoleMatching, pass, skip } from "./utils.js";

const ACP7 = {
    id: "ACP7",
    name: "Tier 2/3 Tech Support via ESATS",
    category: "Access Roles",
    type: "RULE",
    async validate(context) {
        const esatsRoles = context.supportingData?.esatsRoles || [];
        const hasTierSupport = esatsRoles.some(role =>
            /tier\s*2|tier\s*3|technical support/i.test(`${role.roleType || ""} ${role.sourceContactType || ""}`)
        );

        if (!hasTierSupport) {
            return skip(this.id, "ESATS role data was loaded, but no Tier 2/3 Technical Support role was populated.");
        }

        return hasRoleMatching(context, /support|tier\s*2|tier\s*3/i)
            ? pass(this.id, "ESATS has Tier 2/3 Technical Support and ACP-AR1 includes an application support role.")
            : fail(this.id, "ESATS has Tier 2/3 Technical Support, but ACP-AR1 does not include an application support role.");
    }
};

export default ACP7;
