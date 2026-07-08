// checkpoints/helpers.js

export function pass(checkpointId, message, additionalData = {}) {
    return { checkpointId, status: "PASS", message, ...additionalData };
}

export function fail(checkpointId, message, additionalData = {}) {
    return { checkpointId, status: "FAIL", message, ...additionalData };
}

export function warning(checkpointId, message, additionalData = {}) {
    return { checkpointId, status: "WARNING", message, ...additionalData };
}

export function skip(checkpointId, message = "N/A", additionalData = {}) {
    return { checkpointId, status: "N/A", message, ...additionalData };
}

export function getAnswer(context, questionId) {
    if (context.getAnswer) return context.getAnswer(questionId);
    return context.answerMap?.get(questionId) || null;
}

export function getAnswerText(context, questionId) {
    if (context.getAnswerText) return context.getAnswerText(questionId);
    
    const answer = getAnswer(context, questionId);
    if (!answer) return "";
    
    // Cairo API typically has answerOptions[0].internalValue or additionalData
    if (answer.answerOptions && answer.answerOptions.length > 0) {
        return answer.answerOptions
            .map(opt => opt.additionalData || opt.internalValue || opt.displayValue || "")
            .filter(Boolean)
            .join("\n");
    }
    
    return answer.answer || answer.response || answer.value || "";
}

export function asArray(value) {
    if (value == null || value === "") return [];
    return Array.isArray(value) ? value : [value];
}

export function normalizeText(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function valueIncludes(value, needle) {
    const normalizedNeedle = normalizeText(needle);
    return asArray(value).some(item => normalizeText(item).includes(normalizedNeedle));
}

export function getRoleRows(context) {
    return context.roleRows || context.supportingData?.roleRows || [];
}

export function getDatabaseApproverRows(context) {
    return context.databaseApproverRows || context.supportingData?.databaseApproverRows || [];
}

export function getRoleNames(context) {
    return getRoleRows(context)
        .map(row => row.role)
        .filter(Boolean)
        .flatMap(asArray);
}

export function hasRoleMatching(context, patterns) {
    const regexes = asArray(patterns).map(pattern => pattern instanceof RegExp ? pattern : new RegExp(pattern, "i"));
    return getRoleNames(context).some(role => regexes.some(regex => regex.test(String(role))));
}

export function hasAnyLabel(context, patterns, labelType = null) {
    const regexes = asArray(patterns).map(pattern => pattern instanceof RegExp ? pattern : new RegExp(pattern, "i"));
    return (context.supportingData?.assetLabels || []).some(label => {
        if (labelType && normalizeText(label.labelType) !== normalizeText(labelType)) return false;
        return regexes.some(regex => regex.test(String(label.label || "")));
    });
}

// New helpers for ACP1.js
export function findAssessmentById(summary, id) {
    if (!summary || !Array.isArray(summary)) return null;
    return summary.find(item => item.assessmentId === id);
}

export function collectValuesByKey(obj, key) {
    const results = [];
    function traverse(o) {
        if (o !== null && typeof o === 'object') {
            for (const k in o) {
                if (k === key) results.push(o[k]);
                traverse(o[k]);
            }
        }
    }
    traverse(obj);
    return results;
}
