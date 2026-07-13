import { getAnswerText, pass, fail, skip } from "./utils.js";

const ACP19 = {
    id: "ACP19",
    name: "Non-US Person Data Type Match",
    category: "Export Compliance",

    reviewPrompt: `Review this checkpoint against the supplied ACP context. Return JSON only using the ACP review contract: state, whatIsCorrect, whatIsWrong, whyItMatters, howToImprove, suggestedText, evidence, confidence, requiresHumanVerification, and questionsForApplicationTeam. Identify correct content as well as defects. For every applicable checkpoint, suggestedText is required and must be a complete ACP-ready proposed answer that retains verified facts, corrects defects, and uses [PLACEHOLDER] values for unknown facts. Do not invent facts; use NEEDS_VERIFICATION when authoritative evidence is unavailable.`,
    type: "RULE",
    async validate(context) {
        const ar1 = getAnswerText(context, "ACP-AR1");
        if (!ar1) return skip(this.id, "ACP-AR1 data is missing.");
        
        // Simple rule check for the string since we lack a full HTML table parser
        // If the table mentions "Non-US Person" and "US Export - Not Yet Determined", we flag a warning.
        // A true robust check requires parsing the table cells properly.
        if (ar1.includes("Non-US Person") && ar1.includes("US Export - Not Yet Determined")) {
            return fail(this.id, "Non-US Person may have 'US Export - Not Yet Determined' selected.");
        }
        
        return pass(this.id, "No conflicts detected for Non-US Person and Data Type.");
    }
};

export default ACP19;
