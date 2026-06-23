/**
 * core/validation.js
 * Validates assessment contexts against all registered checkpoints.
 * Handles both RULE-based and AI-based checkpoint types.
 */

import { getAllCheckpoints } from './checkpoint.js';
import { sendPrompt, extractJson } from '../ai/aiService.js';
import { logger } from '../utils/utils.js';

// ============================================================
// AI Checkpoint Runner
// ============================================================

/**
 * Runs an AI checkpoint: builds the prompt, sends it to BCAI,
 * parses the JSON response, and returns a standardized result.
 * @param {object} checkpoint
 * @param {object} context
 * @returns {Promise<{ status: string, reason: string }>}
 */
export async function runAiCheckpoint(checkpoint, context) {
    const prompt = checkpoint.buildPrompt(context);
    logger.info(`Running AI checkpoint ${checkpoint.id}`);

    const rawResponse = await sendPrompt(prompt);
    const parsed = extractJson(rawResponse);

    if (!parsed) {
        logger.warn(`Checkpoint ${checkpoint.id}: AI returned unparseable response.`);
        return {
            status: 'FAIL',
            reason: 'AI response could not be parsed as JSON.',
            raw: rawResponse?.slice(0, 200)
        };
    }

    // Normalize: accept status/reason or status/message
    return {
        status: parsed.status || 'FAIL',
        reason: parsed.reason || parsed.message || 'No reason provided.'
    };
}

// ============================================================
// Single Context Validator
// ============================================================

/**
 * Runs all registered checkpoints against a single context.
 * Each checkpoint is handled independently so one failure
 * does not block the rest.
 * @param {object} context
 * @returns {Promise<Array>} Array of checkpoint result objects
 */
export async function validateContext(context) {
    const checkpoints = getAllCheckpoints();
    const results = [];

    for (const checkpoint of checkpoints) {
        try {
            let result;

            if (checkpoint.type === 'AI') {
                const aiResult = await runAiCheckpoint(checkpoint, context);
                result = {
                    checkpointId: checkpoint.id,
                    checkpointName: checkpoint.name,
                    category: checkpoint.category || 'General',
                    status: aiResult.status,
                    message: aiResult.reason,
                    source: 'AI'
                };
            } else {
                const ruleResult = await checkpoint.validate(context);
                result = {
                    checkpointId: checkpoint.id,
                    checkpointName: checkpoint.name,
                    category: checkpoint.category || 'General',
                    status: ruleResult.status || 'FAIL',
                    message: ruleResult.message || '',
                    source: 'RULE'
                };
            }

            results.push(result);

        } catch (err) {
            logger.error(`Checkpoint ${checkpoint.id} threw an error:`, err.message);
            results.push({
                checkpointId: checkpoint.id,
                checkpointName: checkpoint.name,
                category: checkpoint.category || 'General',
                status: 'FAIL',
                message: `Error: ${err.message}`,
                source: checkpoint.type || 'UNKNOWN'
            });
        }
    }

    return results;
}

// ============================================================
// Batch Context Validator
// ============================================================

/**
 * Runs validation for multiple contexts sequentially.
 * @param {Array} contexts
 * @returns {Promise<Array<{ assessmentId, results }>>}
 */
export async function validateContexts(contexts) {
    const validationResults = [];

    for (const context of contexts) {
        const assessmentId =
            context.assessment?.assessmentId ||
            context.detail?.assessmentId ||
            null;

        const results = await validateContext(context);
        validationResults.push({ assessmentId, results });
    }

    return validationResults;
}