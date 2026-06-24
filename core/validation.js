/**
 * core/validation.js
 * Validates assessment contexts against all registered checkpoints.
 * Handles RULE-based, AI-based checkpoint types with full error capture.
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
 * If buildPrompt returns null/undefined (missing data), returns N/A.
 * @param {object} checkpoint
 * @param {object} context
 * @returns {Promise<{ status: string, reason: string }>}
 */
export async function runAiCheckpoint(checkpoint, context) {
    const prompt = checkpoint.buildPrompt(context);
    
    // Checkpoint opted out — missing data
    if (!prompt) {
        return {
            status: 'N/A',
            reason: 'Required context data is missing for this checkpoint.'
        };
    }

    logger.info(`Running AI checkpoint ${checkpoint.id}`);

    let rawResponse;
    try {
        rawResponse = await sendPrompt(prompt);
    } catch (aiErr) {
        // Capture the BCAI error details — do NOT re-throw, just mark as error
        const errorDetail = aiErr.message || String(aiErr);
        logger.error(`AI checkpoint ${checkpoint.id} BCAI error:`, errorDetail);
        return {
            status: 'ERROR',
            reason: `Boeing AI conversation failed: ${errorDetail}`,
            isAiError: true
        };
    }

    const parsed = extractJson(rawResponse);

    if (!parsed) {
        logger.warn(`Checkpoint ${checkpoint.id}: AI returned unparseable response.`);
        return {
            status: 'ERROR',
            reason: 'Boeing AI returned a response that could not be parsed as JSON.',
            rawResponse: rawResponse?.slice(0, 500)
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
 * @param {Function} [isCancelled] - async function returning true if cancelled
 * @returns {Promise<Array>} Array of checkpoint result objects
 */
export async function validateContext(context, isCancelled) {
    const checkpoints = getAllCheckpoints();
    const results = [];

    for (const checkpoint of checkpoints) {
        // Check cancellation before each checkpoint
        if (isCancelled && await isCancelled()) {
            results.push({
                checkpointId: checkpoint.id,
                checkpointName: checkpoint.name,
                category: checkpoint.category || 'General',
                status: 'CANCELLED',
                message: 'Validation was cancelled by user.',
                source: checkpoint.type || 'UNKNOWN'
            });
            continue;
        }

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
                    rawResponse: aiResult.rawResponse || null,
                    isAiError: aiResult.isAiError || false,
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
                status: 'ERROR',
                message: `Unexpected error: ${err.message}`,
                source: checkpoint.type || 'UNKNOWN',
                isAiError: checkpoint.type === 'AI'
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
 * @param {Function} [isCancelled] - optional async cancel check
 * @returns {Promise<Array<{ assessmentId, assessmentTitle, results }>>}
 */
export async function validateContexts(contexts, isCancelled) {
    const validationResults = [];

    for (const context of contexts) {
        if (isCancelled && await isCancelled()) break;

        const assessmentId =
            context.assessment?.assessmentId ||
            context.detail?.assessmentId ||
            null;

        const assessmentTitle =
            context.assessment?.title ||
            context.detail?.assetName ||
            `Assessment ${assessmentId}`;

        if (context.buildError) {
            validationResults.push({
                assessmentId,
                assessmentTitle,
                results: [{
                    checkpointId: 'SETUP',
                    checkpointName: 'Context Gathering',
                    category: 'System',
                    status: 'ERROR',
                    message: `Failed to load assessment data: ${context.buildError}`,
                    source: 'SYSTEM'
                }]
            });
            continue;
        }

        const results = await validateContext(context, isCancelled);
        validationResults.push({ assessmentId, assessmentTitle, results });
    }

    return validationResults;
}