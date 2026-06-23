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
        const opt = answer.answerOptions[0];
        return opt.additionalData || opt.internalValue || "";
    }
    
    return answer.answer || answer.response || answer.value || "";
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