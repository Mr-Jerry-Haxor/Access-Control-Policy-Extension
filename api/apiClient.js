/**
 * api/apiClient.js
 * Unified API client for Cairo and BCAI services.
 */

import { URLS, BCAI } from '../utils/constants.js';
import { fetchJson, postJson } from './requestManager.js';
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

export async function getAssessmentAssetSummary(assetId, assetTypeId = 4, assessmentTypeId = 48) {
    if (!assetId) return [];
    return fetchJson(replaceTokens(URLS.ACP_ASSET_SUMMARY, { assetId, assetTypeId, assessmentTypeId }));
}

export async function getReviewSummaries(assetId, assetTypeId = 4, assessmentTypeId = 48) {
    if (!assetId) return [];
    return fetchJson(replaceTokens(URLS.ACP_REVIEW_SUMMARIES, { assetId, assetTypeId, assessmentTypeId }));
}

export async function getAssessmentContacts(assessmentId) {
    if (!assessmentId) return [];
    return fetchJson(replaceTokens(URLS.ACP_ASSESSMENT_CONTACTS, { id: assessmentId }));
}

export async function getContacts(assessmentId) {
    if (!assessmentId) return [];
    return fetchJson(replaceTokens(URLS.ACP_CONTACTS, { id: assessmentId }));
}

export async function getAssessmentAssets(assessmentId, extra = 'SERVER_ACP') {
    if (!assessmentId) return [];
    return fetchJson(replaceTokens(URLS.ACP_ASSETS, { id: assessmentId, extra }));
}

export async function getWorkflowSteps(assessmentId) {
    if (!assessmentId) return [];
    return fetchJson(replaceTokens(URLS.ACP_WORKFLOW_STEPS, { id: assessmentId }));
}

export async function getAssessmentRecord(assessmentId) {
    if (!assessmentId) return [];
    return fetchJson(replaceTokens(URLS.ACP_RECORD, { id: assessmentId }));
}

export async function getSurveyTemplate(surveyTemplateId) {
    if (!surveyTemplateId) return null;
    return fetchJson(replaceTokens(URLS.ACP_SURVEY_TEMPLATE, { id: surveyTemplateId }));
}

export async function getQuestionGroups(surveyTemplateId) {
    if (!surveyTemplateId) return [];
    return fetchJson(replaceTokens(URLS.ACP_QUESTION_GROUPS, { id: surveyTemplateId }));
}

export async function getSurveyQuestionDetail(assessmentId, questionId) {
    if (!assessmentId || !questionId) return null;
    return fetchJson(replaceTokens(URLS.ACP_SURVEY_QUESTION, { assessmentId, questionId }), { useCache: false });
}

export async function getEsatsRoles(assetId) {
    if (!assetId) return [];
    return fetchJson(replaceTokens(URLS.ESATS_ROLES, { assetId }));
}

export async function getEsatsBusapp(assetId) {
    if (!assetId) return [];
    return fetchJson(replaceTokens(URLS.ESATS_BUSAPP, { assetId }));
}

export async function getIdentities(identityIds) {
    const ids = [...new Set((identityIds || []).filter(Boolean).map(String))];
    if (!ids.length) return [];
    return fetchJson(replaceTokens(URLS.IDENTITY, { ids: ids.join('|') }));
}

export async function getCedPublic(bemsId) {
    if (!bemsId) return [];
    return fetchJson(replaceTokens(URLS.CED_PUBLIC, { bemsId }), { useCache: false });
}

export async function searchAssetLabels(assessmentId) {
    if (!assessmentId) return [];
    return postJson(URLS.ASSET_LABEL_SEARCH, { assessmentId });
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

async function getBcaiXsrfToken() {
    if (!globalThis.chrome?.cookies) return '';

    const byUrl = await new Promise(resolve =>
        chrome.cookies.get({ url: BCAI.ORIGIN, name: 'XSRF-TOKEN' }, resolve)
    );
    if (byUrl?.value) return byUrl.value;

    const byDomain = await new Promise(resolve =>
        chrome.cookies.getAll({ domain: 'boeingai.web.boeing.com' }, resolve)
    );
    return byDomain.find(cookie => cookie.name === 'XSRF-TOKEN')?.value || '';
}

async function readResponseText(response) {
    if (!response.body?.getReader) {
        return await response.text();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return text;
}

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

    // --- Try Direct Fetch First ---
    logger.info('Attempting direct fetch to BCAI endpoint.');
    try {
        const xsrfToken = await getBcaiXsrfToken();

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*'
        };

        if (xsrfToken) headers['X-XSRF-TOKEN'] = xsrfToken;

        const response = await fetch(BCAI.ENDPOINT, {
            method: 'POST',
            credentials: 'include',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return await readResponseText(response);
        } else {
            const errorText = await response.text().catch(() => '');
            logger.warn(`Direct fetch failed (HTTP ${response.status}):`, errorText.slice(0, 200));
            // Will fall through to tab injection fallback
        }
    } catch (err) {
        logger.warn('Direct fetch failed with exception:', err.message);
        // Will fall through to tab injection fallback
    }

    // --- Fallback: Tab Injection ---
    logger.info('Direct fetch failed. Falling back to tab injection.');
    try {
        const tabs = await chrome.tabs.query({ url: '*://boeingai.web.boeing.com/*' });
        const bcaiTab = tabs.find(t => t.id);

        if (!bcaiTab) throw new Error('No active Boeing AI tab found for injection.');

        logger.info('Sending BCAI request via tab injection (tab:', bcaiTab.id, ')');

        const results = await chrome.scripting.executeScript({
            target: { tabId: bcaiTab.id },
            func: async (endpoint, body) => {
                const readResponseText = async (response) => {
                    if (!response.body?.getReader) {
                        return await response.text();
                    }

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let text = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        text += decoder.decode(value, { stream: true });
                    }

                    text += decoder.decode();
                    return text;
                };

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
                            ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {})
                        },
                        body: JSON.stringify(body)
                    });

                    const text = await readResponseText(resp);
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
    } catch (tabErr) {
        logger.error('Both direct fetch and tab injection failed. Final error:', tabErr.message);
        throw tabErr;
    }
}
