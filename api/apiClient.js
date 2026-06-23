/**
 * api/apiClient.js
 * Unified API client for Cairo and BCAI services.
 */

import { URLS, BCAI } from '../utils/constants.js';
import { fetchJson } from './requestManager.js';
import { replaceTokens, logger } from '../utils/utils.js';

// ============================================================
// Cairo API — ACP Data
// ============================================================

export async function getACPList() {
    const data = await fetchJson(URLS.PRIMARY_ACPS);
    if (!Array.isArray(data)) return [];
    
    return data.map(item => ({
        assessmentId: item.incompleteAssessmentId || item.lastAssessmentId || Number(item.assetId),
        title: item.assetName || 'Unknown Title',
        owner: item.incompleteInitiatedByName || item.attestName || 'Unknown Owner',
        status: item.incompleteAssessmentId ? 'Pending' : (item.lastAssessmentId ? 'Completed' : 'Unknown'),
        raw: item
    }));
}

/** Fetches the detail record for a single ACP. */
export async function getACPDetail(assessmentId) {
    const url = replaceTokens(URLS.ACP_DETAIL, { id: assessmentId });
    return fetchJson(url);
}

/** Fetches all answers submitted for an assessment. */
export async function getACPAnswers(assessmentId) {
    const url = replaceTokens(URLS.ACP_ANSWERS, { id: assessmentId });
    return fetchJson(url);
}

/** Fetches all questions for a survey template. */
export async function getACPQuestions(surveyTemplateId) {
    if (!surveyTemplateId) return [];
    const url = replaceTokens(URLS.ACP_QUESTIONS, { id: surveyTemplateId });
    return fetchJson(url);
}

// ============================================================
// Data Helpers
// ============================================================

/** Wraps getACPAnswers and ensures an array is returned. */
export async function loadAnswers(assessmentId) {
    const answers = await getACPAnswers(assessmentId);
    return answers || [];
}

/** Wraps getACPQuestions and ensures an array is returned. */
export async function loadQuestions(surveyTemplateId) {
    const questions = await getACPQuestions(surveyTemplateId);
    return questions || [];
}

/**
 * Builds a Map keyed by alternateQuestionId (preferred) or questionId.
 * @param {Array} answers
 * @returns {Map}
 */
export function buildAnswerMap(answers) {
    const map = new Map();
    for (const answer of answers) {
        const key = answer?.alternateQuestionId || answer?.questionId;
        if (key) map.set(key, answer);
    }
    return map;
}

/**
 * Builds a Map keyed by alternateQuestionId (preferred) or questionId.
 * @param {Array} questions
 * @returns {Map}
 */
export function buildQuestionMap(questions) {
    const map = new Map();
    for (const question of questions) {
        const key = question?.alternateQuestionId || question?.questionId;
        if (key) map.set(key, question);
    }
    return map;
}

/**
 * Fetches detail, answers, and questions for an assessment in parallel.
 * Returns a combined context object.
 */
export async function getACPContext(assessmentId) {
    const detail = await getACPDetail(assessmentId);
    const surveyTemplateId = detail?.surveyTemplateId;

    const [answers, questions] = await Promise.all([
        loadAnswers(assessmentId),
        loadQuestions(surveyTemplateId)
    ]);

    return {
        detail,
        answers,
        questions,
        questionMap: buildQuestionMap(questions),
        answerMap: buildAnswerMap(answers)
    };
}

// ============================================================
// BCAI API — AI Conversation
// ============================================================

/**
 * Sends a conversation payload to the BCAI endpoint.
 * Uses cookie-based authentication (credentials: include).
 * @param {object} payload
 * @returns {string} Raw streamed response text
 */
export async function sendConversation(payload) {
    const response = await fetch(BCAI.ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error('BCAI error:', response.status, errorText.slice(0, 200));
        throw new Error(`BCAI Error ${response.status}: ${response.statusText}`);
    }

    return response.text();
}