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
    RESULTS: 'validationResults',
    BCAI_MODELS: 'bcaiModels',
    BCAI_MODELS_FETCHED_AT: 'bcaiModelsFetchedAt',
    BCAI_SELECTED_MODEL: 'bcaiSelectedModel',
    BCAI_MODEL_USER_SELECTED: 'bcaiModelUserSelected'
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

// ============================================================
// BCAI Model Configuration Store
// ============================================================

export async function saveBcaiModels(models, fetchedAt = Date.now()) {
    await chrome.storage.local.set({
        [KEYS.BCAI_MODELS]: models,
        [KEYS.BCAI_MODELS_FETCHED_AT]: fetchedAt
    });
}

export async function getBcaiModelsState() {
    const result = await chrome.storage.local.get([
        KEYS.BCAI_MODELS,
        KEYS.BCAI_MODELS_FETCHED_AT,
        KEYS.BCAI_SELECTED_MODEL,
        KEYS.BCAI_MODEL_USER_SELECTED
    ]);

    return {
        models: result[KEYS.BCAI_MODELS] || [],
        fetchedAt: result[KEYS.BCAI_MODELS_FETCHED_AT] || 0,
        selectedModelId: result[KEYS.BCAI_SELECTED_MODEL] || null,
        userSelectedModel: result[KEYS.BCAI_MODEL_USER_SELECTED] === true
    };
}

export async function saveSelectedBcaiModel(modelId, userSelected = true) {
    await chrome.storage.local.set({
        [KEYS.BCAI_SELECTED_MODEL]: modelId,
        [KEYS.BCAI_MODEL_USER_SELECTED]: userSelected
    });
}
