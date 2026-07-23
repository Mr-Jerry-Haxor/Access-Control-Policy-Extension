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
    REVIEW_RESULTS: 'reviewResults',
    BCAI_MODELS: 'bcaiModels',
    BCAI_MODELS_FETCHED_AT: 'bcaiModelsFetchedAt',
    BCAI_SELECTED_MODEL: 'bcaiSelectedModel',
    BCAI_MODEL_USER_SELECTED: 'bcaiModelUserSelected',
    STARTUP_BEHAVIOR: 'startupBehavior',
    EXTENSION_SURFACE: 'extensionSurface'
};

let validationWriteQueue = Promise.resolve();
let reviewWriteQueue = Promise.resolve();

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

export async function getStartupBehavior() {
    return (await getValue(KEYS.STARTUP_BEHAVIOR)) || 'restoreCached';
}

export async function saveStartupBehavior(behavior) {
    await setValue(KEYS.STARTUP_BEHAVIOR, behavior);
}

export async function getExtensionSurface() {
    const surface = await getValue(KEYS.EXTENSION_SURFACE);
    return surface === 'sidePanel' ? 'sidePanel' : 'popup';
}

export async function saveExtensionSurface(surface) {
    const normalized = surface === 'sidePanel' ? 'sidePanel' : 'popup';
    await setValue(KEYS.EXTENSION_SURFACE, normalized);
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
    validationWriteQueue = validationWriteQueue.catch(() => {}).then(async () => {
        const existing = await getAllResults();
        existing[assessmentId] = {
            title: title || `Assessment ${assessmentId}`,
            results,
            timestamp: Date.now()
        };
        await setValue(KEYS.RESULTS, existing);
    });
    await validationWriteQueue;
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

export async function saveReviewResult(assessmentId, review, title) {
    reviewWriteQueue = reviewWriteQueue.catch(() => {}).then(async () => {
        const existing = await getAllReviewResults();
        existing[assessmentId] = {
            title: title || `Assessment ${assessmentId}`,
            review,
            timestamp: Date.now()
        };
        await setValue(KEYS.REVIEW_RESULTS, existing);
    });
    await reviewWriteQueue;
}

export async function getAllReviewResults() {
    return (await getValue(KEYS.REVIEW_RESULTS)) || {};
}

export async function clearReviewResults() {
    await removeValue(KEYS.REVIEW_RESULTS);
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
