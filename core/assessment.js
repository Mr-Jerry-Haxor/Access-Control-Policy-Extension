import { saveAcps, saveResults } from '../storage/storage.js';
import { getACPList } from '../api/apiClient.js';
import { getAllCheckpoints, executeCheckpoint } from './checkpoint.js';
import { logger, chunkArray } from '../utils/utils.js';
import { CONFIG } from '../utils/constants.js';

// ============================================================
// ACP Loader
// ============================================================

/**
 * Fetches all ACPs from Cairo and persists them to storage.
 * @returns {Promise<Array>} List of ACP assessment objects
 */
export async function loadAcps() {
    const acps = await getACPList();
    await saveAcps(acps);
    logger.info(`Loaded ${acps.length} ACPs.`);
    return acps;
}

// ============================================================
// Selection State
// ============================================================

let selected = new Set();

export function toggleSelection(id) {
    if (selected.has(id)) {
        selected.delete(id);
    } else {
        selected.add(id);
    }
}

export function selectAll(assessments) {
    selected = new Set(assessments.map(a => a.assessmentId));
}

export function clearSelection() {
    selected.clear();
}

export function getSelectedIds() {
    return [...selected];
}

// ============================================================
// Assessment Validator
// ============================================================

/**
 * Runs all registered checkpoints against a single assessment context.
 * @param {object} context
 * @returns {Promise<Array>} Array of checkpoint results
 */
export async function validateAssessment(context) {
    const checkpoints = getAllCheckpoints();
    const results = [];

    for (const checkpoint of checkpoints) {
        try {
            const result = await executeCheckpoint(checkpoint, context);
            results.push(result);
        } catch (err) {
            logger.error(`Checkpoint ${checkpoint.id} failed:`, err.message);
            results.push({
                checkpointId: checkpoint.id,
                checkpointName: checkpoint.name,
                status: 'FAIL',
                message: `Execution error: ${err.message}`,
                source: checkpoint.type || 'UNKNOWN'
            });
        }
    }

    return results;
}

// ============================================================
// Batch Validator (Concurrent)
// ============================================================

/**
 * Validates an array of assessment contexts with concurrency limiting.
 * Processes assessments in chunks of CONFIG.MAX_CONCURRENT_VALIDATIONS.
 * @param {Array} contexts
 * @returns {Promise<Array<{ assessmentId, validation }>>}
 */
export async function validateAssessments(contexts) {
    const chunks = chunkArray(contexts, CONFIG.MAX_CONCURRENT_VALIDATIONS);
    const allResults = [];

    for (const chunk of chunks) {
        const chunkResults = await Promise.all(
            chunk.map(async context => {
                const assessmentId =
                    context.assessment?.assessmentId ||
                    context.detail?.assessmentId ||
                    null;

                try {
                    const validation = await validateAssessment(context);
                    await saveResults(assessmentId, validation);
                    return { assessmentId, validation };
                } catch (err) {
                    logger.error(`Validation failed for ${assessmentId}:`, err.message);
                    return {
                        assessmentId,
                        validation: [],
                        error: err.message
                    };
                }
            })
        );

        allResults.push(...chunkResults);
        logger.info(`Validated chunk: ${allResults.length}/${contexts.length}`);
    }

    return allResults;
}