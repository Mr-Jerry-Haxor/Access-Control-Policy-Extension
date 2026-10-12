import { buildReviewPrompt, fail, getAssetLabels, hasRoleMatching, needsReview, normalizeText, pass, skip } from "./utils.js";

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
        const labels = getAssetLabels(context);
        if (!labels.length) return needsReview(this.id, "Risk Profiler-derived asset labels are unavailable.");
        const developmentLabels = labels.filter(label => /development channel|ip owner/i.test(normalizeText(label.labelType)));
        const text = developmentLabels.map(label => label.label).join(" ");
        if (!text) return needsReview(this.id, "No Risk Profiler IP-owner/development-channel label is available.");
        if (!/boeing developed|boeing owned|\bboeing\b/i.test(text)) return skip(this.id, "Risk Profiler does not identify the application as Boeing-owned.");
        return hasRoleMatching(context, /developer|programmer|software engineer/i)
            ? pass(this.id, "Risk Profiler identifies Boeing ownership and ACP-AR1 includes a developer role.")
            : fail(this.id, "Risk Profiler identifies Boeing ownership, but ACP-AR1 has no developer role.");
    }
};

export default ACP9;
