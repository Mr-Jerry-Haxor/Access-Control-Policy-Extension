/**
 * core/checkpoint.js
 * Registry and executor for all ACP checkpoints.
 *
 * IMPORTANT: All ACP*.js files use `export default`, not named exports.
 * Import them as default imports.
 */

import { runAiCheckpoint } from './validation.js';
import { logger } from '../utils/utils.js';

// ============================================================
// Checkpoint Imports (default exports)
// ============================================================

import ACP1  from '../checkpoints/ACP1.js';
import ACP2  from '../checkpoints/ACP2.js';
import ACP3  from '../checkpoints/ACP3.js';
import ACP4  from '../checkpoints/ACP4.js';
import ACP5  from '../checkpoints/ACP5.js';
import ACP6  from '../checkpoints/ACP6.js';
import ACP7  from '../checkpoints/ACP7.js';
import ACP8  from '../checkpoints/ACP8.js';
import ACP9  from '../checkpoints/ACP9.js';
import ACP10 from '../checkpoints/ACP10.js';
import ACP11 from '../checkpoints/ACP11.js';
import ACP12 from '../checkpoints/ACP12.js';
import ACP13 from '../checkpoints/ACP13.js';
import ACP14 from '../checkpoints/ACP14.js';
import ACP15 from '../checkpoints/ACP15.js';
import ACP16 from '../checkpoints/ACP16.js';
import ACP17 from '../checkpoints/ACP17.js';
import ACP18 from '../checkpoints/ACP18.js';
import ACP19 from '../checkpoints/ACP19.js';
import ACP20 from '../checkpoints/ACP20.js';
import ACP21 from '../checkpoints/ACP21.js';
import ACP22 from '../checkpoints/ACP22.js';
import ACP23 from '../checkpoints/ACP23.js';
import ACP24 from '../checkpoints/ACP24.js';
import ACP25 from '../checkpoints/ACP25.js';
import ACP26 from '../checkpoints/ACP26.js';
import ACP27 from '../checkpoints/ACP27.js';
import ACP28 from '../checkpoints/ACP28.js';
import ACP29 from '../checkpoints/ACP29.js';
import ACP30 from '../checkpoints/ACP30.js';

// ============================================================
// Checkpoint Registry
// ============================================================

const ALL = [
    ACP1, ACP2, ACP3, ACP4, ACP5, ACP6, ACP7, ACP8, ACP9, ACP10,
    ACP11, ACP12, ACP13, ACP14, ACP15, ACP16, ACP17, ACP18, ACP19, ACP20,
    ACP21, ACP22, ACP23, ACP24, ACP25, ACP26, ACP27, ACP28, ACP29, ACP30
];

// Filter to only checkpoints that have been implemented (have an `id` property)
export const CHECKPOINTS = ALL.filter(cp => cp && cp.id);

logger.info(`Registered ${CHECKPOINTS.length} checkpoints.`);

// ============================================================
// Registry Access
// ============================================================

export function getAllCheckpoints() {
    return CHECKPOINTS;
}

export function getCheckpoint(id) {
    return CHECKPOINTS.find(cp => cp.id === id) || null;
}

// ============================================================
// Checkpoint Executor
// ============================================================

/**
 * Executes a single checkpoint against a context.
 * Routes to AI or RULE execution based on checkpoint type.
 * @param {object} checkpoint
 * @param {object} context
 * @returns {Promise<object>} Result object
 */
export async function executeCheckpoint(checkpoint, context) {
    if (checkpoint.type === 'AI') {
        return runAiCheckpoint(checkpoint, context);
    }
    return checkpoint.validate(context);
}