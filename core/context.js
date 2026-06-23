/**
 * core/context.js
 * Builds, caches, and validates assessment context objects.
 */

import {
    getACPDetail,
    loadQuestions,
    loadAnswers,
    buildQuestionMap,
    buildAnswerMap
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
 * @param {{ assessment, detail, questions, answers, questionMap, answerMap }} data
 */
export function createContext({ assessment, detail, questions, answers, questionMap, answerMap }) {
    return {
        assessment,
        detail,
        questions,
        answers,
        questionMap,
        answerMap,

        getQuestion(checkpointId) {
            return questionMap.get(checkpointId) || null;
        },

        getAnswer(checkpointId) {
            return answerMap.get(checkpointId) || null;
        },

        getAnswerText(checkpointId) {
            const answer = answerMap.get(checkpointId);
            if (!answer) return '';
            return answer.answer || answer.value || answer.response || '';
        }
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

    const context = createContext({
        assessment,
        detail,
        questions,
        answers,
        questionMap,
        answerMap
    });

    validateContext(context);
    contextCache.set(assessmentId, context);

    logger.info('Built context for:', assessmentId);
    return context;
}

/**
 * Builds contexts for multiple assessments.
 * Individual failures are caught and logged without stopping the batch.
 * @param {Array} assessments
 * @returns {Promise<Array>} Successfully built contexts
 */
export async function buildContexts(assessments) {
    const results = [];

    for (const assessment of assessments) {
        try {
            const context = await buildContext(assessment);
            results.push(context);
        } catch (err) {
            logger.error(`Failed to build context for ${assessment.assessmentId}:`, err.message);
        }
    }

    logger.info(`Built ${results.length}/${assessments.length} contexts.`);
    return results;
}