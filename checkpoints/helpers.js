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

export function getAnswer(context, questionId) {
    return context.answerMap.get(questionId) || null;
}

export function getAnswerText(context, questionId) {
    const answer = getAnswer(context, questionId);
    if (!answer) return "";
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