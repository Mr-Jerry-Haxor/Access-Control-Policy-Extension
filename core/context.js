/**
 * core/context.js
 * Builds, caches, and validates assessment context objects.
 */

import {
    getACPDetail,
    loadQuestions,
    loadAnswers,
    buildQuestionMap,
    buildAnswerMap,
    getAssessmentAssetSummary,
    getReviewSummaries,
    getAssessmentContacts,
    getContacts,
    getAssessmentAssets,
    getWorkflowSteps,
    getAssessmentRecord,
    getSurveyTemplate,
    getQuestionGroups,
    getSurveyQuestionDetail,
    getEsatsRoles,
    getEsatsBusapp,
    getIdentities,
    getCedPublic,
    searchAssetLabels
} from '../api/apiClient.js';
import { logger } from '../utils/utils.js';

// ============================================================
// Context Cache
// ============================================================

const contextCache = new Map();

export function getCachedContext(assessmentId) {
    return contextCache.get(assessmentId) || null;
}

export function clearContextCache() {
    contextCache.clear();
}

// ============================================================
// Context Factory
// ============================================================

/**
 * Creates a context object with helper accessor methods.
 * @param {{ assessment, detail, questions, answers, questionMap, answerMap, supportingData }} data
 */
export function createContext({ assessment, detail, questions, answers, questionMap, answerMap, supportingData }) {
    return {
        assessment,
        detail,
        questions,
        answers,
        questionMap,
        answerMap,
        supportingData,
        reviewSummary: supportingData?.reviewSummaries || [],
        roleRows: supportingData?.roleRows || [],
        databaseApproverRows: supportingData?.databaseApproverRows || [],

        getQuestion(checkpointId) {
            return questionMap.get(checkpointId) || null;
        },

        getAnswer(checkpointId) {
            return answerMap.get(checkpointId) || null;
        },

        getAnswerText(checkpointId) {
            const answer = answerMap.get(checkpointId);
            const answerText = getAnswerTextFromAnswer(answer);
            const tableText = supportingData?.questionTables?.[checkpointId]?.text || '';
            if (tableText && /no answer but can collect additional information/i.test(answerText)) {
                return tableText;
            }
            if (answerText) return answerText;
            return tableText;
        }
    };
}

function getAnswerTextFromAnswer(answer) {
    if (!answer) return '';
    if (answer.answerOptions && answer.answerOptions.length > 0) {
        return answer.answerOptions
            .map(option => option.additionalData || option.internalValue || option.displayValue || '')
            .filter(Boolean)
            .join('\n');
    }
    return answer.answer || answer.value || answer.response || '';
}

function cleanKey(value) {
    return String(value || '')
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
        .replace(/^[A-Z]/, chr => chr.toLowerCase());
}

function normalizeRowGroup(value) {
    const raw = String(value ?? '0');
    return raw.split('.')[0] || raw;
}

function itemValue(item) {
    return item?.dataCollector?.resolvedCollectorValue ||
        item?.dataCollector?.collectorValue ||
        item?.dataCollectorOption?.internalValue ||
        item?.dataCollectorOption?.displayValue ||
        '';
}

function normalizeQuestionTable(detail) {
    const collectors = new Map();
    for (const collector of detail?.dataCollectors || []) {
        collectors.set(collector.dataCollectorAssociationId, {
            key: cleanKey(collector.dataCollector?.shortDescription || collector.dataCollector?.longDescription),
            label: collector.dataCollector?.shortDescription || collector.dataCollector?.longDescription || String(collector.dataCollectorAssociationId),
            sortOn: Number(collector.sortOn || collector.dataCollectorAssociation?.sortOn || 0)
        });
    }

    const rows = new Map();
    for (const item of detail?.collectedDataItems || []) {
        const group = normalizeRowGroup(item?.dataCollector?.rowGroupNumber);
        if (!rows.has(group)) rows.set(group, { rowGroupNumber: group, rawItems: [] });

        const row = rows.get(group);
        const collector = collectors.get(item?.dataCollector?.dataCollectorAssociationId) || {};
        const key = collector.key || cleanKey(item?.dataCollectorAssociation?.dataCollectorId || 'value');
        const value = itemValue(item);
        if (!value) continue;

        if (row[key]) {
            row[key] = Array.isArray(row[key]) ? [...row[key], value] : [row[key], value];
        } else {
            row[key] = value;
        }
        row.rawItems.push(item);
    }

    const orderedRows = [...rows.values()].sort((a, b) => Number(a.rowGroupNumber) - Number(b.rowGroupNumber));
    const labels = [...collectors.values()].sort((a, b) => a.sortOn - b.sortOn);
    const text = orderedRows.map(row => {
        return labels
            .map(({ key, label }) => {
                const value = row[key];
                if (!value) return null;
                return `${label}: ${Array.isArray(value) ? value.join(', ') : value}`;
            })
            .filter(Boolean)
            .join(' | ');
    }).filter(Boolean).join('\n');

    return { rows: orderedRows, collectors: labels, text, raw: detail };
}

function extractQuestionId(questionMap, alternateQuestionId) {
    return questionMap.get(alternateQuestionId)?.surveyTemplateQuestionId || null;
}

function addId(set, value) {
    if (value != null && value !== '') set.add(String(value));
}

function collectIdentityIds({ assessment, detail, assessmentContacts, contacts }) {
    const ids = new Set();

    for (const contact of assessmentContacts || []) {
        addId(ids, contact.associatedToIdentityId);
    }

    for (const contact of contacts || []) {
        addId(ids, contact.associatedToIdentityId);
    }

    addId(ids, assessment?.incompleteInitiatedById || assessment?.raw?.incompleteInitiatedById);
    addId(ids, detail?.initiatedByIdentityId);

    return [...ids];
}

function collectBemsIdsFromRows(rows) {
    const ids = new Set();
    for (const row of rows || []) {
        for (const value of Object.values(row)) {
            const values = Array.isArray(value) ? value : [value];
            for (const item of values) {
                if (/^\d{3,}$/.test(String(item || '').trim())) {
                    ids.add(String(item).trim());
                }
            }
        }
    }
    return [...ids];
}

async function buildSupportingData({ assessment, detail, questions, questionMap }) {
    const assessmentId = assessment.assessmentId;
    const assetId = String(assessment.assetId || detail?.assets?.[0]?.assetId || detail?.assetId || '');
    const assetTypeId = Number(assessment.assetTypeId || 4);
    const assessmentTypeId = Number(detail?.assessmentTypeId || 48);
    const surveyTemplateId = detail?.surveyTemplateId;

    const [assetSummary, reviewSummaries, assessmentContacts, contacts, assets, workflowSteps, assessmentRecord, surveyTemplate, questionGroups, esatsRoles, esatsBusapp, assetLabels] = await Promise.all([
        getAssessmentAssetSummary(assetId, assetTypeId, assessmentTypeId).catch(err => ({ error: err.message })),
        getReviewSummaries(assetId, assetTypeId, assessmentTypeId).catch(err => ({ error: err.message })),
        getAssessmentContacts(assessmentId).catch(err => ({ error: err.message })),
        getContacts(assessmentId).catch(err => ({ error: err.message })),
        getAssessmentAssets(assessmentId, 'SERVER_ACP').catch(err => ({ error: err.message })),
        getWorkflowSteps(assessmentId).catch(err => ({ error: err.message })),
        getAssessmentRecord(assessmentId).catch(err => ({ error: err.message })),
        getSurveyTemplate(surveyTemplateId).catch(err => ({ error: err.message })),
        getQuestionGroups(surveyTemplateId).catch(err => ({ error: err.message })),
        getEsatsRoles(assetId).catch(err => ({ error: err.message })),
        getEsatsBusapp(assetId).catch(err => ({ error: err.message })),
        searchAssetLabels(assessmentId).catch(err => ({ error: err.message }))
    ]);

    const questionDetails = {};
    for (const altId of ['ACP-AR1', 'ACP-RAP4']) {
        const questionId = extractQuestionId(questionMap, altId);
        if (!questionId) continue;
        try {
            questionDetails[altId] = await getSurveyQuestionDetail(assessmentId, questionId);
        } catch (err) {
            questionDetails[altId] = { error: err.message };
        }
    }

    const questionTables = {};
    for (const [altId, questionDetail] of Object.entries(questionDetails)) {
        if (!questionDetail?.error) {
            questionTables[altId] = normalizeQuestionTable(questionDetail);
        }
    }

    const roleRows = questionTables['ACP-AR1']?.rows || [];
    const databaseApproverRows = questionTables['ACP-RAP4']?.rows || [];
    const identityIds = collectIdentityIds({ assessment, detail, assessmentContacts, contacts });
    const identities = await getIdentities(identityIds).catch(err => ({ error: err.message }));
    const cedIds = collectBemsIdsFromRows(databaseApproverRows);
    const cedPublic = {};
    for (const bemsId of cedIds) {
        try {
            cedPublic[bemsId] = await getCedPublic(bemsId);
        } catch (err) {
            cedPublic[bemsId] = { error: err.message };
        }
    }

    return {
        assetId,
        assetTypeId,
        assessmentTypeId,
        assetSummary,
        reviewSummaries,
        assessmentContacts,
        contacts,
        assets,
        workflowSteps,
        assessmentRecord,
        surveyTemplate,
        questionGroups,
        questionDetails,
        questionTables,
        roleRows,
        databaseApproverRows,
        esatsRoles,
        esatsBusapp,
        assetLabels,
        identities,
        cedPublic
    };
}

// ============================================================
// Context Validation
// ============================================================

/** Throws descriptive errors if the context is incomplete. */
export function validateContext(context) {
    if (!context)           throw new Error('Context is missing.');
    if (!context.detail)    throw new Error('Assessment detail is missing from context.');
    if (!context.questions) throw new Error('Questions are missing from context.');
    if (!context.answers)   throw new Error('Answers are missing from context.');
    return true;
}

// ============================================================
// Context Builder
// ============================================================

/**
 * Builds a complete assessment context for a single assessment.
 * Returns from cache if available.
 * @param {object} assessment
 * @returns {Promise<object>} Context
 */
export async function buildContext(assessment) {
    const assessmentId = assessment.assessmentId;

    const cached = getCachedContext(assessmentId);
    if (cached) {
        logger.debug('Context cache hit:', assessmentId);
        return cached;
    }

    const detail = await getACPDetail(assessmentId);
    const surveyTemplateId = detail?.surveyTemplateId;

    const [questions, answers] = await Promise.all([
        loadQuestions(surveyTemplateId),
        loadAnswers(assessmentId)
    ]);

    const questionMap = buildQuestionMap(questions);
    const answerMap = buildAnswerMap(answers);
    const supportingData = await buildSupportingData({
        assessment,
        detail,
        questions,
        questionMap
    });

    const context = createContext({
        assessment,
        detail,
        questions,
        answers,
        questionMap,
        answerMap,
        supportingData
    });

    validateContext(context);
    contextCache.set(assessmentId, context);

    logger.info('Built context for:', assessmentId);
    return context;
}

export async function buildContexts(assessments) {
    const results = [];

    for (const assessment of assessments) {
        try {
            const context = await buildContext(assessment);
            results.push(context);
        } catch (err) {
            logger.error(`Failed to build context for ${assessment.assessmentId}:`, err.message);
            results.push({
                assessment,
                buildError: err.message
            });
        }
    }

    logger.info(`Built ${results.filter(c => !c.buildError).length}/${assessments.length} contexts successfully.`);
    return results;
}
