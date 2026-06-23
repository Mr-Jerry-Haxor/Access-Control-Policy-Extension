/**
 * storage/storage.js
 * Unified storage layer — wraps chrome.storage.local
 * No circular imports. All storage logic lives here.
 */

// ============================================================
// Private Helpers
// ============================================================

async function getValue(key) {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
}

async function setValue(key, value) {
    await chrome.storage.local.set({ [key]: value });
}

async function removeValue(key) {
    await chrome.storage.local.remove(key);
}

// ============================================================
// Storage Keys
// ============================================================

const KEYS = {
    ACPS: 'acps',
    SELECTED: 'selectedAcps',
    CONVERSATION: 'bcaiConversation',
    RESULTS: 'validationResults'
};

// ============================================================
// Assessment Store
// ============================================================

export async function saveAcps(acps) {
    await setValue(KEYS.ACPS, acps);
}

export async function getAcps() {
    return (await getValue(KEYS.ACPS)) || [];
}

export async function saveSelectedAcps(ids) {
    await setValue(KEYS.SELECTED, ids);
}

export async function getSelectedAcps() {
    return (await getValue(KEYS.SELECTED)) || [];
}

// ============================================================
// Conversation Store
// ============================================================

export async function getConversation() {
    return await getValue(KEYS.CONVERSATION);
}

export async function saveConversation(conversation) {
    await setValue(KEYS.CONVERSATION, conversation);
}

export async function clearConversation() {
    await removeValue(KEYS.CONVERSATION);
}

// ============================================================
// Result Store
// ============================================================

/**
 * Saves validation results for an assessment.
 * @param {string|number} assessmentId
 * @param {Array} results
 * @param {string} [title] - Optional display title for the assessment
 */
export async function saveResults(assessmentId, results, title) {
    const existing = await getAllResults();
    existing[assessmentId] = {
        title: title || `Assessment ${assessmentId}`,
        results,
        timestamp: Date.now()
    };
    await setValue(KEYS.RESULTS, existing);
}

export async function getResults(assessmentId) {
    const all = await getAllResults();
    return all[assessmentId] || null;
}

export async function getAllResults() {
    return (await getValue(KEYS.RESULTS)) || {};
}

export async function clearResults() {
    await removeValue(KEYS.RESULTS);
}