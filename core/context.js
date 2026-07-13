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
export function createContext({ assessment, detail, questions, answers, questionMap, answerMap, supportingData, normalizedQuestions }) {
    const normalizedQuestionMap = new Map();
    for (const question of normalizedQuestions || []) {
        for (const alias of question.aliases || []) normalizedQuestionMap.set(String(alias), question);
    }
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
        normalizedQuestions: normalizedQuestions || [],
        normalizedQuestionMap,

        getQuestion(checkpointId) {
            return questionMap.get(String(checkpointId)) || null;
        },

        getAnswer(checkpointId) {
            return answerMap.get(String(checkpointId)) || null;
        },

        getAnswerText(checkpointId) {
            const normalized = normalizedQuestionMap.get(String(checkpointId));
            if (normalized) return normalized.answerText || normalized.table?.text || '';
            const answer = answerMap.get(String(checkpointId));
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
            .map(option => cleanRichText(option.additionalData) || option.displayValue || option.internalValue || '')
            .filter(Boolean)
            .join('\n');
    }
    return answer.answer || answer.value || answer.response || '';
}

function cleanRichText(value) {
    return String(value || '')
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<\/p\s*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
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

function itemValue(item, labelLookup) {
    return item?.dataCollector?.resolvedCollectorValue ||
        item?.dataCollector?.collectorValue ||
        item?.dataCollectorOption?.internalValue ||
        item?.dataCollectorOption?.displayValue ||
        labelLookup?.get(String(item?.dataCollector?.labelId)) ||
        '';
}

export function normalizeQuestionTable(detail, assetLabels = []) {
    const labelLookup = new Map((Array.isArray(assetLabels) ? assetLabels : [])
        .filter(item => item?.labelId != null)
        .map(item => [String(item.labelId), item.label]));
    const collectors = new Map();
    for (const collector of detail?.dataCollectors || []) {
        collectors.set(collector.dataCollectorAssociationId, {
            key: cleanKey(collector.dataCollector?.shortDescription || collector.dataCollector?.longDescription),
            label: collector.dataCollector?.shortDescription || collector.dataCollector?.longDescription || String(collector.dataCollectorAssociationId),
            sortOn: Number(collector.sortOn || collector.dataCollectorAssociation?.sortOn || 0),
            required: collector.collectorRequired === 'Y',
            multipleEntriesAllowed: collector.multipleEntriesAllowed === 'Y',
            collectorTypeDescriptionId: collector.dataCollector?.collectorTypeDescriptionId || null
        });
    }

    const rows = new Map();
    for (const item of detail?.collectedDataItems || []) {
        const group = normalizeRowGroup(item?.dataCollector?.rowGroupNumber);
        if (!rows.has(group)) rows.set(group, { rowGroupNumber: group, cells: [], rawItems: [] });

        const row = rows.get(group);
        const collector = collectors.get(item?.dataCollector?.dataCollectorAssociationId) || {};
        const key = collector.key || cleanKey(item?.dataCollectorAssociation?.dataCollectorId || 'value');
        const value = itemValue(item, labelLookup);
        if (!value) continue;

        if (row[key]) {
            row[key] = Array.isArray(row[key]) ? [...row[key], value] : [row[key], value];
        } else {
            row[key] = value;
        }
        let cell = row.cells.find(candidate => candidate.key === key);
        if (!cell) {
            cell = { key, label: collector.label || key, values: [] };
            row.cells.push(cell);
        }
        cell.values.push({
            value,
            rawValue: item?.dataCollector?.collectorValue ?? null,
            resolvedValue: item?.dataCollector?.resolvedCollectorValue ?? null,
            optionValue: item?.dataCollectorOption?.displayValue || item?.dataCollectorOption?.internalValue || null,
            associationId: item?.dataCollector?.dataCollectorAssociationId || item?.dataCollectorAssociation?.dataCollectorAssociationId || null
        });
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

function getQuestionGroup(question) {
    return question?.questionGroup?.shortDescription ||
        question?.questionGroup?.longDescription ||
        String(question?.surveyTemplateQuestionGroupId || 'General');
}

function normalizeQuestionEvidence(question, answer, table, detailError) {
    const aliases = [...new Set([
        question?.alternateQuestionId,
        question?.surveyTemplateQuestionId,
        question?.questionId,
        question?.priorVersionQuestionId,
        answer?.alternateQuestionId,
        answer?.surveyTemplateQuestionId
    ].filter(value => value != null && value !== '').map(String))];
    const selectedOptions = (answer?.answerOptions || []).map(option => ({
        optionId: option.questionAnswerOptionId || null,
        value: option.displayValue || option.internalValue || '',
        internalValue: option.internalValue || '',
        additionalText: cleanRichText(option.additionalData),
        rawAdditionalData: option.additionalData || null
    }));
    const answerParts = selectedOptions.flatMap(option => [option.value, option.additionalText])
        .filter(value => value && !/^This question type (captures|has no answer)/i.test(value));
    const answerText = [...new Set(answerParts)].join('\n');
    const availableOptions = (question?.options || []).map(option => ({
        optionId: option.questionAnswerOptionId,
        displayValue: option.displayValue,
        internalValue: option.internalValue,
        allowsAdditionalData: option.additionalDataAllowed === 'Y'
    }));

    return {
        id: question?.alternateQuestionId || String(question?.surveyTemplateQuestionId || question?.questionId),
        aliases,
        alternateQuestionId: question?.alternateQuestionId || answer?.alternateQuestionId || null,
        surveyTemplateQuestionId: question?.surveyTemplateQuestionId || answer?.surveyTemplateQuestionId || null,
        baseQuestionId: question?.questionId || null,
        priorVersionQuestionId: question?.priorVersionQuestionId || null,
        group: getQuestionGroup(question),
        sortOn: Number(question?.sortOn || 0),
        questionText: cleanRichText(question?.questionText),
        questionType: question?.questionType || 'Unknown',
        questionTypeId: question?.questionTypeId || null,
        multipleAnswersAllowed: question?.multipleAnswersAllowed === 'Y',
        displayAsCheckbox: question?.displayAnswerAsCheckbox === 'Y',
        availableOptions,
        selectedOptions,
        answerText,
        answered: !!answer || !!table?.rows?.length,
        table: table ? {
            columns: table.collectors,
            rows: table.rows.map(row => ({ rowGroupNumber: row.rowGroupNumber, cells: row.cells })),
            text: table.text
        } : null,
        questionDetailLoadError: detailError || null,
        conditionalRules: (question?.actions || []).flatMap(action => action.logics || []),
        controls: (question?.controls || []).map(control => ({ number: control.controlNumber, title: control.controlTitle }))
    };
}

export function buildNormalizedQuestions(questions, answerMap, questionTables, questionDetails = {}) {
    return (questions || []).map(question => {
        const key = String(question.alternateQuestionId || question.surveyTemplateQuestionId || question.questionId);
        const answer = answerMap.get(key) || answerMap.get(String(question.surveyTemplateQuestionId));
        return normalizeQuestionEvidence(question, answer, questionTables[key], questionDetails[key]?.error);
    }).sort((a, b) => a.group.localeCompare(b.group) || a.sortOn - b.sortOn);
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
    const uniqueQuestions = [...new Map((questions || []).map(question => [question.surveyTemplateQuestionId, question])).values()];
    for (let index = 0; index < uniqueQuestions.length; index += 5) {
        const batch = uniqueQuestions.slice(index, index + 5);
        const details = await Promise.all(batch.map(async question => {
            const altId = question.alternateQuestionId || String(question.surveyTemplateQuestionId);
            try {
                return [altId, await getSurveyQuestionDetail(assessmentId, question.surveyTemplateQuestionId)];
            } catch (err) {
                return [altId, { error: err.message }];
            }
        }));
        for (const [altId, detailValue] of details) questionDetails[altId] = detailValue;
    }

    const questionTables = {};
    for (const [altId, questionDetail] of Object.entries(questionDetails)) {
        if (!questionDetail?.error) {
            questionTables[altId] = normalizeQuestionTable(questionDetail, assetLabels);
        }
    }

    const roleRows = questionTables['ACP-AR1']?.rows || [];
    const databaseApproverRows = questionTables['ACP-RAP4']?.rows || [];
    const identityIds = collectIdentityIds({ assessment, detail, assessmentContacts, contacts });
    const identities = await getIdentities(identityIds).catch(err => ({ error: err.message }));
    const allTableRows = Object.values(questionTables).flatMap(table => table.rows || []);
    const cedIds = collectBemsIdsFromRows(allTableRows);
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
    const normalizedQuestions = buildNormalizedQuestions(questions, answerMap, supportingData.questionTables, supportingData.questionDetails);

    const context = createContext({
        assessment,
        detail,
        questions,
        answers,
        questionMap,
        answerMap,
        supportingData,
        normalizedQuestions
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
