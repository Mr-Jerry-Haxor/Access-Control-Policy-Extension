import { buildReviewPrompt, fail, getAnswerText, getCedRecord, getNpiRows, needsReview, pass, rowValues, skip } from "./utils.js";

const ACP19 = {
    id: "ACP19",
    name: "NPI owners are active",
    category: "Non-Person Identifiers",
    type: "RULE",
    reviewPrompt: buildReviewPrompt({
        checkpointId: "ACP19",
        requirement: "When ACP-NPI1 is Yes, every NPI owner is active at the time of ACP review; ACP-NPI1 No is N/A.",
        targetQuestion: "ACP-NPI1 Non Person Account Owner",
        correction: "the NPI rows whose owner must be replaced or verified"
    }),
    async validate(context) {
        if (/^no$/i.test(getAnswerText(context, "ACP-NPI1").trim())) return skip(this.id, "ACP-NPI1 is No.");
        const rows = getNpiRows(context);
        if (!rows.length) return fail(this.id, "No NPI table rows are listed.");
        const owners = [...new Set(rows.flatMap(row => rowValues(row, "nonPersonAccountOwner")).map(String))];
        if (!owners.length) return fail(this.id, "No NPI owner IDs are listed.");
        const missing = owners.filter(id => !getCedRecord(context, id));
        if (missing.length) return needsReview(this.id, `CED evidence is unavailable for ${missing.length} NPI owner(s).`);
        const inactive = owners.filter(id => String(getCedRecord(context, id)?.status || "").toUpperCase() !== "A");
        return inactive.length
            ? fail(this.id, `${inactive.length} NPI owner(s) are not active in CED.`)
            : pass(this.id, `All ${owners.length} NPI owner(s) have active CED status.`);
    }
};

export default ACP19;
