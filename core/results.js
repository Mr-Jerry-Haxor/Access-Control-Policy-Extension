/**
 * core/results.js
 * Score calculation and result aggregation.
 */

// ============================================================
// Score Calculator
// ============================================================

/**
 * Calculates pass/fail/total/percentage from an array of checkpoint results.
 * @param {Array<{ status: string }>} results
 * @returns {{ passed: number, failed: number, warned: number, total: number, percentage: number }}
 */
export function calculateScore(results) {
    let passed = 0;
    let failed = 0;
    let warned = 0;

    for (const result of results) {
        if (result.status === 'PASS')        passed++;
        else if (result.status === 'WARNING') warned++;
        else                                  failed++;
    }

    const total = passed + failed + warned;
    const percentage = total === 0 ? 0 : Math.round((passed / total) * 100);

    return { passed, failed, warned, total, percentage };
}

// ============================================================
// Result Aggregator
// ============================================================

/**
 * Wraps a flat results array into a summary + detail object.
 * @param {Array} validationResults
 * @returns {{ summary: object, results: Array }}
 */
export function aggregateResults(validationResults) {
    return {
        summary: calculateScore(validationResults),
        results: validationResults
    };
}