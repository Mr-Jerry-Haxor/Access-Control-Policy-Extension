/**
 * api/apiClient.js
 * Unified API client for Cairo and BCAI services.
 */

import { URLS, BCAI, CONFIG } from '../utils/constants.js';
import { fetchJson, postJson } from './requestManager.js';
import { replaceTokens, logger } from '../utils/utils.js';

// ============================================================
// Cairo API — ACP Data
// ============================================================

function unwrapCairoData(value) {
    return value && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'data')
        ? value.data
        : value;
}

export async function getACPList() {
    const data = unwrapCairoData(await fetchJson(URLS.PRIMARY_ACPS));
    if (!Array.isArray(data)) return [];
    
    return data.map(item => {
        const isIncomplete = !!(item.incompleteAssessmentId || item.incompleteInitiatedOn);
        return {
            assessmentId: item.incompleteAssessmentId || item.lastAssessmentId || Number(item.assetId),
            assetId: item.assetId,
            assetTypeId: item.assetTypeId || 4,
            assetSourceId: item.assetSourceId || 82,
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

/** Fetches the full Risk Profiler assessment list. */
export async function getRiskProfilerAssessmentList() {
    const data = unwrapCairoData(await fetchJson(URLS.RISK_PROFILER_ASSESSMENTS));
    if (!Array.isArray(data)) throw new Error('Risk Profiler assessment list is not a valid array.');
    return data;
}

/** Fetches answers for a selected Risk Profiler assessment. */
export async function getRiskProfilerAssessmentAnswers(assessmentId) {
    const url = replaceTokens(URLS.RISK_PROFILER_ANSWERS, { id: assessmentId });
    const data = await fetchJson(url);
    const answers = Array.isArray(data) ? data : data?.answers;
    if (!Array.isArray(answers)) throw new Error(`Risk Profiler assessment ${assessmentId} answers are not a valid array.`);
    return answers;
}

/** Selects a Risk Profiler row only when both asset ID and asset name match. */
export function selectRiskProfilerAssessment(rows, assetId, assetName) {
    const expectedId = String(assetId ?? '').trim();
    const expectedName = String(assetName ?? '').trim();
    if (!expectedId || !expectedName || !Array.isArray(rows)) return null;

    const matches = rows.filter(row =>
        String(row?.assetId ?? '').trim() === expectedId &&
        String(row?.assetName ?? '').trim() === expectedName
    );
    if (!matches.length) return null;

    return matches.sort((left, right) =>
        Number(right?.lastAssessmentId || 0) - Number(left?.lastAssessmentId || 0)
    )[0];
}

function answerTimestamp(answer) {
    for (const value of [answer?.updatedOn, answer?.createdOn]) {
        const timestamp = Date.parse(String(value || ''));
        if (!Number.isNaN(timestamp)) return timestamp;
    }
    return 0;
}

function answerValues(answer) {
    const values = [];
    for (const option of answer?.answerOptions || []) {
        values.push(option?.internalValue ?? option?.displayValue ?? option?.additionalData);
    }
    if (!values.length) values.push(answer?.answer, answer?.value, answer?.response);
    const unique = new Map();
    for (const value of values) {
        const text = String(value ?? '').trim();
        const key = text.toLowerCase();
        if (text && !unique.has(key)) unique.set(key, text);
    }
    return [...unique.values()];
}

/** Extracts the newest unambiguous value for each requested Risk Profiler question. */
export function extractRiskProfilerAnswers(answers, questionIds = ['CSIR-IPOwner', 'CSIR-SvcAcct']) {
    const output = {};
    for (const questionId of questionIds) {
        const matches = (Array.isArray(answers) ? answers : [])
            .filter(answer => String(answer?.alternateQuestionId || '').trim().toLowerCase() === questionId.toLowerCase())
            .sort((left, right) =>
                answerTimestamp(right) - answerTimestamp(left) ||
                Number(right?.assessmentSurveyAnswerId || 0) - Number(left?.assessmentSurveyAnswerId || 0)
            );
        const values = answerValues(matches[0]);
        if (values.length === 1) output[questionId] = values[0];
    }
    return output;
}

/** Loads the last completed Risk Profiler answers for an exact ACP asset match. */
export async function getRiskProfilerEvidence(assetId, assetName) {
    const rows = await getRiskProfilerAssessmentList();
    const match = selectRiskProfilerAssessment(rows, assetId, assetName);
    if (!match) return { status: 'no-match', assetId, assetName, answers: {} };

    const assessmentId = match.lastAssessmentId;
    if (!/^[1-9]\d*$/.test(String(assessmentId ?? ''))) {
        return { status: 'no-assessment', assetId, assetName, answers: {} };
    }

    const answers = await getRiskProfilerAssessmentAnswers(assessmentId);
    return {
        status: 'found',
        assetId: match.assetId,
        assetName: match.assetName,
        assessmentId,
        answers: extractRiskProfilerAnswers(answers)
    };
}

/** Fetches all questions for a survey template. */
export async function getACPQuestions(surveyTemplateId) {
    if (!surveyTemplateId) return [];
    const url = replaceTokens(URLS.ACP_QUESTIONS, { id: surveyTemplateId });
    return unwrapCairoData(await fetchJson(url));
}

export async function getAssessmentAssetSummary(assetId, assetTypeId = 4, assessmentTypeId = 48) {
    if (!assetId) return [];
    return fetchJson(replaceTokens(URLS.ACP_ASSET_SUMMARY, { assetId, assetTypeId, assessmentTypeId }));
}

export async function getReviewSummaries(assetId, assetTypeId = 4, assessmentTypeId = 48) {
    if (!assetId) return [];
    return unwrapCairoData(await fetchJson(replaceTokens(URLS.ACP_REVIEW_SUMMARIES, { assetId, assetTypeId, assessmentTypeId })));
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
    return unwrapCairoData(await fetchJson(replaceTokens(URLS.ACP_ASSETS, { id: assessmentId, extra })));
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
    return unwrapCairoData(await fetchJson(replaceTokens(URLS.ACP_SURVEY_QUESTION, { assessmentId, questionId }), { useCache: false }));
}

export async function getEsatsRoles(assetId) {
    if (!assetId) return [];
    return fetchJson(replaceTokens(URLS.ESATS_ROLES, { assetId }));
}

export async function getEsatsBusapp(assetId) {
    if (!assetId) return [];
    return fetchJson(replaceTokens(URLS.ESATS_BUSAPP, { assetId }));
}

export async function getGsepDatabases(assetId) {
    if (!assetId) return [];
    return fetchJson(replaceTokens(URLS.GSEP_DATABASES, { assetId }));
}

export async function getSisServerIds(assetId) {
    if (!assetId) return [];
    return fetchJson(replaceTokens(URLS.SIS_SERVER_IDS, { assetId }));
}

export async function getSisServers(serverIds) {
    const ids = [...new Set((serverIds || []).filter(Boolean).map(String))];
    if (!ids.length) return [];
    return fetchJson(replaceTokens(URLS.SIS_SERVERS, { serverIds: ids.join('|') }));
}

export async function getIdentities(identityIds) {
    const ids = [...new Set((identityIds || []).filter(Boolean).map(String))];
    if (!ids.length) return [];
    return fetchJson(replaceTokens(URLS.IDENTITY, { ids: ids.join('|') }));
}

export async function getCedPublic(bemsId) {
    if (!bemsId) return [];
    return unwrapCairoData(await fetchJson(replaceTokens(URLS.CED_PUBLIC, { bemsId }), { useCache: false }));
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
        for (const key of [answer?.alternateQuestionId, answer?.surveyTemplateQuestionId, answer?.questionId]) {
            if (key != null && key !== '') map.set(String(key), answer);
        }
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
        for (const key of [question?.alternateQuestionId, question?.surveyTemplateQuestionId, question?.questionId, question?.priorVersionQuestionId]) {
            if (key != null && key !== '') map.set(String(key), question);
        }
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

const RETRYABLE_BCAI_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function bcaiError(status, body, operation = 'request') {
    const detail = parseBcaiErrorDetail(body);
    const error = new Error(`BCAI ${operation} failed${status ? ` (HTTP ${status})` : ''}: ${detail}`);
    error.name = 'BcaiRequestError';
    error.status = Number(status) || 0;
    error.retryable = !status || RETRYABLE_BCAI_STATUSES.has(Number(status));
    return error;
}

function parseBcaiErrorDetail(body) {
    const text = String(body || '').trim();
    if (!text) return 'No error detail was returned.';
    try {
        const parsed = JSON.parse(text);
        return String(parsed?.detail || parsed?.message || parsed?.error?.message || text).slice(0, 500);
    } catch {
        return text.slice(0, 500);
    }
}

function timeoutSignal(externalSignal, timeoutMs = CONFIG.BCAI_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const abortFromExternal = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) abortFromExternal();
    else externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException('BCAI request timed out.', 'TimeoutError')), timeoutMs);
    return {
        signal: controller.signal,
        cleanup() {
            clearTimeout(timer);
            externalSignal?.removeEventListener?.('abort', abortFromExternal);
        }
    };
}

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

async function fetchFromBcaiTab(endpoint, options = {}) {
    const tabs = await chrome.tabs.query({ url: '*://boeingai.web.boeing.com/*' });
    const bcaiTab = tabs.find(t => t.id);

    if (!bcaiTab) throw new Error('No active Boeing AI tab found for injection.');

    const results = await chrome.scripting.executeScript({
        target: { tabId: bcaiTab.id },
        func: async (url, requestOptions, timeoutMs) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const xsrfMeta = document.cookie
                    .split(';')
                    .map(c => c.trim())
                    .find(c => c.startsWith('XSRF-TOKEN='));
                const xsrfToken = xsrfMeta ? xsrfMeta.split('=')[1] : '';

                const resp = await fetch(url, {
                    credentials: 'include',
                    ...requestOptions,
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        ...(requestOptions.headers || {}),
                        ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {})
                    }
                });

                const text = await resp.text();
                if (!resp.ok) {
                    return { error: true, status: resp.status, body: text.slice(0, 500) };
                }
                return { error: false, text };
            } catch (e) {
                return {
                    error: true,
                    status: 0,
                    body: e?.name === 'AbortError' ? 'BCAI request timed out.' : e.message
                };
            } finally {
                clearTimeout(timer);
            }
        },
        args: [endpoint, options, CONFIG.BCAI_REQUEST_TIMEOUT_MS]
    });

    const result = results?.[0]?.result;
    if (!result) throw new Error('BCAI tab injection returned no result.');
    if (result.error) throw bcaiError(result.status, result.body, 'tab request');
    return result.text;
}

async function fetchBcaiJson(endpoint, options = {}, { signal } = {}) {
    const timed = timeoutSignal(signal);
    try {
        const xsrfToken = await getBcaiXsrfToken();
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            ...(options.headers || {})
        };
        if (xsrfToken) headers['X-XSRF-TOKEN'] = xsrfToken;

        const response = await fetch(endpoint, {
            credentials: 'include',
            ...options,
            headers,
            signal: timed.signal
        });
        const text = await response.text();
        if (response.ok) return JSON.parse(text);

        const error = bcaiError(response.status, text);
        // A page-context request can recover cookie-bound 401/403 responses.
        if (![401, 403].includes(response.status)) throw error;
        logger.warn(`Direct BCAI request returned HTTP ${response.status}; trying the authenticated tab.`);
    } catch (error) {
        if (signal?.aborted) throw new DOMException('Operation cancelled.', 'AbortError');
        if (timed.signal.aborted) throw bcaiError(0, 'BCAI request timed out.');
        if (error?.name === 'BcaiRequestError') throw error;
        logger.warn('Direct BCAI request was unavailable; trying the authenticated tab:', error.message);
    } finally {
        timed.cleanup();
    }

    if (signal?.aborted) throw new DOMException('Operation cancelled.', 'AbortError');
    const text = await fetchFromBcaiTab(endpoint, options);
    if (signal?.aborted) throw new DOMException('Operation cancelled.', 'AbortError');
    try {
        return JSON.parse(text);
    } catch {
        throw bcaiError(0, 'BCAI returned invalid JSON.');
    }
}

function normalizeBcaiModel(model) {
    const modelId = model?.model_id || model?.modelId || model?.id || '';
    if (!modelId) return null;
    const maxTokens = model?.max_tokens || model?.maxTokens || '';

    return {
        model_id: modelId,
        model_type: model?.model_type || model?.modelType || modelId,
        display_name: model?.display_name || model?.displayName || modelId,
        model_family: model?.model_family || model?.modelFamily || '',
        max_tokens: maxTokens,
        max_context_tokens: parseTokenLimit(maxTokens),
        response_max_tokens: Number(model?.response_max_tokens ?? model?.responseMaxTokens ?? 0) || null,
        default_response_max_tokens: Number(model?.default_response_max_tokens ?? model?.defaultResponseMaxTokens ?? 0) || null,
        short_description: model?.short_description || model?.shortDescription || '',
        description: model?.description || '',
        allowed_info_types: Array.isArray(model?.allowed_info_types) ? model.allowed_info_types : [],
        supported_parameters: Array.isArray(model?.supported_parameters) ? model.supported_parameters : [],
        retirement_date: model?.retirement_date || null
    };
}

function parseTokenLimit(value) {
    if (typeof value === 'number') return value;
    const numeric = String(value || '').replace(/[^\d]/g, '');
    return Number(numeric) || null;
}

export async function getBcaiModels() {
    logger.info(`Fetching BCAI models compatible with ${BCAI.DATA_SOURCES[0]}.`);
    try {
        const sources = await fetchBcaiJson(BCAI.DATA_SOURCES_ENDPOINT, { method: 'GET' });
        const source = Array.isArray(sources)
            ? sources.find(item => BCAI.DATA_SOURCES.includes(item?.name))
            : null;
        if (!source) throw new Error(`BCAI data source is unavailable: ${BCAI.DATA_SOURCES[0]}`);
        const available = Array.isArray(source.available_models) ? source.available_models : [];
        if (!available.length) throw new Error(`BCAI returned no models for ${source.name}.`);
        return available.map(model => ({
            ...normalizeBcaiModel(model),
            data_source: source.name,
            preferred_for_data_source: model?.model_id === source.preferred_model
        })).filter(model => model.model_id);
    } catch (sourceError) {
        logger.warn('BCAI combined source/model discovery failed; intersecting the separate catalogs:', sourceError.message);
    }

    const [sources, models] = await Promise.all([
        fetchBcaiJson(BCAI.DATA_SOURCE_CATALOG_ENDPOINT, { method: 'GET' }),
        fetchBcaiJson(BCAI.MODELS_ENDPOINT, { method: 'GET' })
    ]);
    const source = Array.isArray(sources)
        ? sources.find(item => BCAI.DATA_SOURCES.includes(item?.name))
        : null;
    if (!source || !Array.isArray(source.models)) {
        throw new Error(`BCAI data source is unavailable: ${BCAI.DATA_SOURCES[0]}`);
    }
    const compatibleIds = new Set(source.models);
    return (Array.isArray(models) ? models : [])
        .filter(model => compatibleIds.has(model?.model_id))
        .map(model => ({
            ...normalizeBcaiModel(model),
            data_source: source.name,
            preferred_for_data_source: model?.model_id === source.preferred_model
        }))
        .filter(model => model.model_id);
}

export async function getBcaiAuthorization() {
    const value = await fetchBcaiJson(BCAI.AUTHORIZED_ENDPOINT, { method: 'GET' });
    const authorized = value?.is_authorized === true || String(value?.is_authorized).toLowerCase() === 'true';
    return { authorized };
}

export async function countBcaiTokens(input, model, { signal } = {}) {
    const value = await fetchBcaiJson(BCAI.TOKEN_COUNT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, model })
    }, { signal });
    const count = Number(value?.token_count);
    if (!Number.isFinite(count) || count < 0) throw bcaiError(0, 'BCAI returned an invalid token count.');
    return count;
}

/**
 * Sends a conversation payload to the BCAI endpoint by injecting the fetch
 * into an existing boeingai.web.boeing.com tab. This ensures all session
 * cookies are included automatically from the browser context.
 * Falls back to direct fetch if no BCAI tab is found.
 * @param {object} payload
 * @returns {string} Raw streamed response text
 */
export async function sendConversation(payload, { signal } = {}) {
    // --- Validate payload: ensure Responses input has non-null text ---
    const requestPayload = {
        ...payload,
        input: (payload.input || []).map(msg => ({
            ...msg,
            content: Array.isArray(msg.content)
                ? msg.content.map(c => ({
                    ...c,
                    text: (c.text != null && c.text !== '') ? c.text : '[empty]'
                }))
                : (typeof msg.content === 'string' ? msg.content : '[empty]')
        }))
    };

    // --- Try Direct Fetch First ---
    logger.info('Attempting direct fetch to BCAI endpoint.');
    const timed = timeoutSignal(signal);
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
            body: JSON.stringify(requestPayload),
            signal: timed.signal
        });

        if (response.ok) {
            return await readResponseText(response);
        }
        const errorText = await response.text().catch(() => '');
        if (![401, 403].includes(response.status)) {
            throw bcaiError(response.status, errorText, 'conversation');
        }
        logger.warn(`Direct BCAI conversation returned HTTP ${response.status}; trying the authenticated tab.`);
    } catch (err) {
        if (signal?.aborted) throw new DOMException('Operation cancelled.', 'AbortError');
        if (timed.signal.aborted) throw bcaiError(0, 'BCAI conversation timed out.', 'conversation');
        if (err?.name === 'BcaiRequestError') throw err;
        logger.warn('Direct BCAI conversation was unavailable; trying the authenticated tab:', err.message);
    } finally {
        timed.cleanup();
    }

    // --- Fallback: Tab Injection ---
    if (signal?.aborted) throw new DOMException('Operation cancelled.', 'AbortError');
    logger.info('Direct fetch failed. Falling back to tab injection.');
    try {
        const tabs = await chrome.tabs.query({ url: '*://boeingai.web.boeing.com/*' });
        const bcaiTab = tabs.find(t => t.id);

        if (!bcaiTab) throw new Error('No active Boeing AI tab found for injection.');

        logger.info('Sending BCAI request via tab injection (tab:', bcaiTab.id, ')');

        const results = await chrome.scripting.executeScript({
            target: { tabId: bcaiTab.id },
            func: async (endpoint, body, timeoutMs) => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);
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
                        body: JSON.stringify(body),
                        signal: controller.signal
                    });

                    const text = await readResponseText(resp);
                    if (!resp.ok) {
                        return { error: true, status: resp.status, body: text.slice(0, 500) };
                    }
                    return { error: false, text };
                } catch (e) {
                    return {
                        error: true,
                        status: 0,
                        body: e?.name === 'AbortError' ? 'BCAI conversation timed out.' : e.message
                    };
                } finally {
                    clearTimeout(timer);
                }
            },
            args: [BCAI.ENDPOINT, requestPayload, CONFIG.BCAI_REQUEST_TIMEOUT_MS]
        });

        const result = results?.[0]?.result;
        if (signal?.aborted) throw new DOMException('Operation cancelled.', 'AbortError');
        if (!result) throw new Error('Tab injection returned no result.');

        if (result.error) {
            throw bcaiError(result.status, result.body, 'conversation');
        }

        return result.text;
    } catch (tabErr) {
        logger.error('Both direct fetch and tab injection failed. Final error:', tabErr.message);
        throw tabErr;
    }
}
