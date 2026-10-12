import { buildReviewPrompt, fail, hasRoleMatching, needsReview, normalizeText, pass, skip } from "./utils.js";

const ACP9 = {
    id: "ACP9",
    name: "Boeing-owned application has developer role",
    category: "Access Roles",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP9",
        requirement: "When Risk Profiler CSIR-IPOwner is Boeing, ACP-AR1 contains a developer role.",
        targetQuestion: "ACP-AR1",
        correction: "the missing developer role fields or the evidenced N/A rationale"
    }),
    async validate(context) {
        const riskProfiler = context.supportingData?.riskProfiler;
        const ipOwner = riskProfiler?.answers?.["CSIR-IPOwner"];
        if (riskProfiler?.status !== "found" || !normalizeText(ipOwner)) {
            return needsReview(this.id, "The matching Risk Profiler last assessment or its CSIR-IPOwner answer is unavailable.");
        }
        if (normalizeText(ipOwner) !== "boeing") {
            return skip(this.id, `Risk Profiler CSIR-IPOwner is ${ipOwner}, not Boeing.`);
        }
        return hasRoleMatching(context, /developer|programmer|software engineer/i)
            ? pass(this.id, "Risk Profiler CSIR-IPOwner is Boeing and ACP-AR1 includes a developer role.")
            : fail(this.id, "Risk Profiler CSIR-IPOwner is Boeing, but ACP-AR1 has no developer role.");
    }
};

export default ACP9;
