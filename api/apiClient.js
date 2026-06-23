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
    
    return data.map(item => {
        const isIncomplete = !!(item.incompleteAssessmentId || item.incompleteInitiatedOn);
        return {
            assessmentId: item.incompleteAssessmentId || item.lastAssessmentId || Number(item.assetId),
            title: item.assetName || 'Unknown Title',
            owner: isIncomplete ? item.incompleteInitiatedByName : item.attestName,
            status: isIncomplete ? 'Incomplete' : 'Completed',
            date: isIncomplete ? item.incompleteInitiatedOn : item.surveyCompletedOn,
            dueDate: item.dueOn,
            raw: item
        };
    });
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

export async function loadAnswers(assessmentId) {
    const data = await getACPAnswers(assessmentId);
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.answers && Array.isArray(data.answers)) return data.answers;
    return [];
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
// BCAI API — AI Conversation via Tab Injection
// ============================================================

/**
 * Sends a conversation payload to the BCAI endpoint by injecting the fetch
 * into an existing boeingai.web.boeing.com tab. This ensures all session
 * cookies are included automatically from the browser context.
 * Falls back to direct fetch if no BCAI tab is found.
 * @param {object} payload
 * @returns {string} Raw streamed response text
 */
export async function sendConversation(payload) {
    // --- Validate payload: ensure messages have non-null text ---
    if (payload.messages) {
        payload.messages = payload.messages.map(msg => ({
            ...msg,
            content: Array.isArray(msg.content)
                ? msg.content.map(c => ({
                    ...c,
                    text: (c.text != null && c.text !== '') ? c.text : '[empty]'
                }))
                : (typeof msg.content === 'string' ? msg.content : '[empty]')
        }));
    }

    // --- Try to find an existing BCAI tab ---
    try {
        const tabs = await chrome.tabs.query({ url: '*://boeingai.web.boeing.com/*' });
        const bcaiTab = tabs.find(t => t.id);

        if (bcaiTab) {
            logger.info('Sending BCAI request via tab injection (tab:', bcaiTab.id, ')');

            const results = await chrome.scripting.executeScript({
                target: { tabId: bcaiTab.id },
                func: async (endpoint, body) => {
                    try {
                        const xsrfMeta = document.cookie
                            .split(';')
                            .map(c => c.trim())
                            .find(c => c.startsWith('XSRF-TOKEN='));
                        const xsrfToken = xsrfMeta ? xsrfMeta.split('=')[1] : '';

                        const resp = await fetch(endpoint, {
                            method: 'POST',
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json, text/plain, */*',
                                'sec-fetch-dest': 'empty',
                                'sec-fetch-mode': 'cors',
                                'sec-fetch-site': 'same-origin',
                                ...(xsrfToken ? { 'x-xsrf-token': xsrfToken } : {})
                            },
                            body: JSON.stringify(body)
                        });

                        const text = await resp.text();
                        if (!resp.ok) {
                            return { error: true, status: resp.status, body: text.slice(0, 500) };
                        }
                        return { error: false, text };
                    } catch (e) {
                        return { error: true, status: 0, body: e.message };
                    }
                },
                args: [BCAI.ENDPOINT, payload]
            });

            const result = results?.[0]?.result;
            if (!result) throw new Error('Tab injection returned no result.');

            if (result.error) {
                throw new Error(`BCAI Tab Error ${result.status}: ${result.body}`);
            }

            return result.text;
        }
    } catch (tabErr) {
        if (!tabErr.message.includes('BCAI Tab Error')) {
            logger.warn('Tab injection failed, falling back to direct fetch:', tabErr.message);
        } else {
            throw tabErr;
        }
    }

    // --- Fallback: direct fetch with cookie-based auth ---
    logger.info('No BCAI tab found. Attempting direct fetch.');
    let xsrfToken = '';
    try {
        if (chrome && chrome.cookies) {
            const cookie = await new Promise(resolve =>
                chrome.cookies.get({ url: 'https://boeingai.web.boeing.com', name: 'XSRF-TOKEN' }, resolve)
            );
            if (cookie) xsrfToken = cookie.value;
        }
    } catch (err) {
        logger.warn('Failed to read XSRF-TOKEN cookie:', err.message);
    }

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
    };

    if (xsrfToken) {
        headers['x-xsrf-token'] = xsrfToken;
    }

    const response = await fetch(BCAI.ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: headers,
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error('BCAI error:', response.status, errorText.slice(0, 200));
        throw new Error(`BCAI Error ${response.status}: ${errorText.slice(0, 300)}`);
    }

    return response.text();
}