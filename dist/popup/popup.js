/**
 * popup/popup.js
 * Integrated ACP Validator - UI Logic
 */

import {
    getAcps,
    saveAcps,
    getSelectedAcps,
    saveSelectedAcps,
    getAllResults,
    getAllReviewResults,
    saveReviewResult,
    clearResults,
    clearReviewResults,
    getStartupBehavior,
    saveStartupBehavior,
    getExtensionSurface
} from "../storage/storage.js";

let allAcps = [];
let filteredAcps = [];
let selectedIds = [];
let pollInterval = null;
let bcaiModels = [];
let selectedModelId = null;
let startupBehavior = 'restoreCached';
let extensionSurface = 'popup';
let activeReviewResult = null;
let activeReviewAssessmentId = null;
let activeReviewTitle = null;
let lastFocusedElement = null;
let noticeTimer = null;
let automationBusy = false;
let applicationOwners = [];
let selectedApplicationOwner = '';

const $ = id => document.getElementById(id);

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
} else {
    initialize();
}

async function initialize() {
    // 1. Check prerequisites automatically
    checkPrereqSessions();
    // 2. Load existing selections
    selectedIds = (await getSelectedAcps()).map(String);
    startupBehavior = await getStartupBehavior();
    extensionSurface = await getExtensionSurface();
    renderStartupBehavior();
    renderExtensionSurface();
    // 3. Load primary data according to the configured browser behavior
    await loadInitialAssessmentData();
    await loadModelConfiguration();
    attachEvents();
    updateSelectedCount();
    await loadExistingResults();
    await resumeActiveOperation();
}

function attachEvents() {
    $("refreshBtn").addEventListener("click", refreshData);
    $("settingsBtn").addEventListener("click", openSettingsModal);
    $("closeSettingsBtn").addEventListener("click", closeSettingsModal);
    $("settingsModal").addEventListener("click", handleSettingsBackdropClick);
    $("refreshModelsBtn").addEventListener("click", () => loadModelConfiguration({ force: true }));
    $("modelSelect").addEventListener("change", handleModelSelection);
    document.querySelectorAll('input[name="startupBehavior"]').forEach(input => {
        input.addEventListener("change", handleStartupBehaviorChange);
    });
    document.querySelectorAll('input[name="extensionSurface"]').forEach(input => {
        input.addEventListener("change", handleExtensionSurfaceChange);
    });
    $("checkPrereqBtn").addEventListener("click", checkPrereqSessions);
    $("selectAllBtn").addEventListener("click", handleSelectAll);
    $("clearSelectionBtn").addEventListener("click", handleClearSelection);
    $("validateBtn").addEventListener("click", startValidation);
    $("reviewBtn").addEventListener("click", startReview);
    $("cancelValidationBtn").addEventListener("click", cancelValidation);
    $("cancelReviewBtn").addEventListener("click", cancelReview);
    $("clearFiltersBtn").addEventListener("click", clearFilters);
    $("clearValidationResultsBtn").addEventListener("click", clearValidationResultsAndUI);
    $("clearReviewResultsBtn").addEventListener("click", clearReviewResultsAndUI);
    $("closeReviewNotesBtn").addEventListener("click", closeReviewNotes);
    $("closeNewQuestionsBtn").addEventListener("click", () => closeModal($("newQuestionsModal")));
    $("reviewSearchInput").addEventListener("input", renderActiveReviewAnalysis);
    $("reviewStateFilter").addEventListener("change", renderActiveReviewAnalysis);
    document.querySelectorAll('[data-results-tab]').forEach(button => button.addEventListener('click', switchResultsTab));
    document.querySelectorAll('[role="tablist"]').forEach(tabList => tabList.addEventListener('keydown', handleTabKeydown));
    document.addEventListener('keydown', handleGlobalKeydown);
    [$("reviewNotesModal"), $("newQuestionsModal")].forEach(modal => modal.addEventListener('click', event => {
        if (event.target === modal) closeModal(modal);
    }));

    $("searchInput").addEventListener("input", applyFilters);
    $("regexMode").addEventListener("change", applyFilters);
    $("dateFilterField").addEventListener("change", applyFilters);
    $("assessmentStatusFilter").addEventListener("change", applyFilters);
    $("dateStartFilter").addEventListener("change", applyFilters);
    $("dateEndFilter").addEventListener("change", applyFilters);
    $("ownerSearchInput").addEventListener("focus", showOwnerOptions);
    $("ownerSearchInput").addEventListener("input", () => {
        selectedApplicationOwner = '';
        updateOwnerOptions();
        showOwnerOptions();
        applyFilters();
    });
    $("ownerSearchInput").addEventListener("keydown", handleOwnerSearchKeydown);
    $("ownerOptions").addEventListener("keydown", handleOwnerOptionKeydown);
    document.addEventListener("click", event => {
        if (!event.target.closest('.manager-search-select')) hideOwnerOptions();
    });
}

// ==========================================
// SETTINGS / MODEL CONFIGURATION
// ==========================================

function renderStartupBehavior() {
    const selected = document.querySelector(`input[name="startupBehavior"][value="${startupBehavior}"]`);
    if (selected) selected.checked = true;
}

async function handleStartupBehaviorChange(event) {
    startupBehavior = event.target.value;
    await saveStartupBehavior(startupBehavior);
}

function renderExtensionSurface(message = "") {
    const sidePanelSupported = Boolean(chrome.sidePanel && chrome.action?.setPopup);
    const selected = document.querySelector(`input[name="extensionSurface"][value="${extensionSurface}"]`);
    const sidePanelOption = document.querySelector('input[name="extensionSurface"][value="sidePanel"]');

    if (selected) selected.checked = true;
    if (sidePanelOption) sidePanelOption.disabled = !sidePanelSupported;

    const status = $("extensionSurfaceStatus");
    if (!status) return;
    if (message) {
        status.textContent = message;
    } else if (!sidePanelSupported) {
        status.textContent = "Side pane mode is unavailable in this browser version.";
    } else {
        status.textContent = extensionSurface === "sidePanel"
            ? "Side pane mode is active. The toolbar icon will open the side pane."
            : "Popup mode is active.";
    }
}

async function handleExtensionSurfaceChange(event) {
    const requestedSurface = event.target.value;
    const inputs = [...document.querySelectorAll('input[name="extensionSurface"]')];
    let finalStatus = "";
    inputs.forEach(input => { input.disabled = true; });
    renderExtensionSurface(`Switching to ${requestedSurface === "sidePanel" ? "side pane" : "popup"} mode...`);

    try {
        const response = await chrome.runtime.sendMessage({
            action: "SET_EXTENSION_SURFACE",
            surface: requestedSurface
        });
        if (!response?.success) {
            throw new Error(response?.error || "Unable to change the extension display.");
        }

        extensionSurface = response.surface;
        finalStatus = response.message;
        showNotice(response.message);
    } catch (error) {
        extensionSurface = await getExtensionSurface();
        finalStatus = `Display mode was not changed: ${error.message}`;
        showNotice(`Unable to change display mode: ${error.message}`, { persistent: true });
    } finally {
        const sidePanelSupported = Boolean(chrome.sidePanel && chrome.action?.setPopup);
        inputs.forEach(input => {
            input.disabled = input.value === "sidePanel" && !sidePanelSupported;
        });
        renderExtensionSurface(finalStatus);
    }
}

async function loadModelConfiguration({ force = false } = {}) {
    setModelStatus(force ? "Refreshing BCAI models..." : "Loading BCAI models...");
    $("refreshModelsBtn").disabled = true;
    $("modelSelect").disabled = true;

    try {
        const response = await chrome.runtime.sendMessage({ action: "LOAD_BCAI_MODELS", force });
        if (!response?.success) {
            throw new Error(response?.error || "Unable to load BCAI models.");
        }

        bcaiModels = response.models || [];
        selectedModelId = response.selectedModelId || bcaiModels[0]?.model_id || null;
        renderModelSelector();
        renderModelDetails();
        updateModelCacheStatus(response);
    } catch (err) {
        setModelStatus(`Model configuration unavailable: ${err.message}`);
        $("modelSelect").innerHTML = '<option value="">No models available</option>';
        $("modelDetails").innerHTML = "";
    } finally {
        $("refreshModelsBtn").disabled = false;
        $("modelSelect").disabled = bcaiModels.length === 0;
    }
}

function openSettingsModal() {
    openModal($("settingsModal"));
    renderModelDetails();
}

function closeSettingsModal() {
    closeModal($("settingsModal"));
}

function handleSettingsBackdropClick(event) {
    if (event.target === $("settingsModal")) closeSettingsModal();
}

async function handleModelSelection(event) {
    selectedModelId = event.target.value;
    renderModelDetails();

    const response = await chrome.runtime.sendMessage({
        action: "SAVE_BCAI_MODEL",
        modelId: selectedModelId
    });

    if (!response?.success) {
        setModelStatus(`Failed to save selected model: ${response?.error || "Unknown error"}`);
        return;
    }

    const model = getSelectedModel();
    setModelStatus(`Selected model: ${model?.display_name || selectedModelId}`);
}

function renderModelSelector() {
    const select = $("modelSelect");
    select.innerHTML = "";

    if (!bcaiModels.length) {
        select.innerHTML = '<option value="">No models available</option>';
        return;
    }

    bcaiModels.forEach(model => {
        const option = document.createElement("option");
        option.value = model.model_id;
        option.textContent = `${model.display_name || model.model_id}${model.model_family ? ` (${model.model_family})` : ""}`;
        select.appendChild(option);
    });

    select.value = selectedModelId;
}

function renderModelDetails() {
    const model = getSelectedModel();
    const container = $("modelDetails");

    if (!model) {
        container.innerHTML = '<div class="settings-muted">Select a model to view its limits and supported parameters.</div>';
        return;
    }

    const supportedParams = model.supported_parameters || [];
    const allowedInfoTypes = model.allowed_info_types || [];
    const defaultTokens = model.default_response_max_tokens || "N/A";
    const responseTokens = model.response_max_tokens || "N/A";

    container.innerHTML = `
        <div class="model-detail-row"><strong>Model ID</strong><span>${escapeHtml(model.model_id)}</span></div>
        <div class="model-detail-row"><strong>Context Window</strong><span>${escapeHtml(model.max_tokens || "N/A")}</span></div>
        <div class="model-detail-row"><strong>Default Response Tokens</strong><span>${escapeHtml(formatNumber(defaultTokens))}</span></div>
        <div class="model-detail-row"><strong>Maximum Response Tokens</strong><span>${escapeHtml(formatNumber(responseTokens))}</span></div>
        <div class="model-detail-row"><strong>Retirement Date</strong><span>${escapeHtml(model.retirement_date || "N/A")}</span></div>
        <div class="model-detail-row"><strong>Description</strong><span>${escapeHtml(model.short_description || model.description || "N/A")}</span></div>
        <div class="model-detail-row">
            <strong>Allowed Info Types</strong>
            <span class="model-tags">${renderTags(allowedInfoTypes)}</span>
        </div>
        <div class="model-detail-row">
            <strong>Supported Parameters</strong>
            <span class="model-tags">${renderTags(supportedParams)}</span>
        </div>
    `;
}

function getSelectedModel() {
    return bcaiModels.find(model => model.model_id === selectedModelId) || null;
}

function updateModelCacheStatus(response) {
    const fetchedAt = response.fetchedAt ? new Date(response.fetchedAt).toLocaleString() : "N/A";
    const source = response.fromCache ? "Loaded from local cache" : "Fetched from BCAI";
    const stale = response.stale ? " Cache is stale because refresh failed." : "";
    const selection = response.userSelectedModel ? "Using your selected model." : "Defaulting to the highest context window model.";
    setModelStatus(`${source}. Last refreshed: ${fetchedAt}. ${selection}${stale}`);
}

function setModelStatus(message) {
    $("modelCacheStatus").textContent = message;
}

function renderTags(values) {
    if (!values.length) return '<span>N/A</span>';
    return values.map(value => `<span class="model-tag">${escapeHtml(value)}</span>`).join("");
}

function formatNumber(value) {
    if (typeof value === "number") return value.toLocaleString();
    return value;
}

// ==========================================
// RENDERERS
// ==========================================

function renderAssessments() {
    const container = $("assessmentList");
    container.innerHTML = "";

    if (!filteredAcps.length) {
        container.innerHTML = '<div class="empty-state empty-state-panel">No assessments match the current filters.</div>';
        return;
    }

    filteredAcps.forEach(acp => {
        const status = getAssessmentStatus(acp);
        const row = document.createElement("div");
        row.className = `assessment-row ${status.className}`;
        row.setAttribute('role', 'listitem');

        row.innerHTML = `
            <input type="checkbox" class="assessment-checkbox" data-id="${acp.assessmentId}" aria-label="Select ${escapeHtml(acp.title || `assessment ${acp.assessmentId}`)}" ${selectedIds.includes(String(acp.assessmentId)) ? "checked" : ""}>
            <div class="assessment-meta">
                <div class="asset-name">
                    <span>${escapeHtml(acp.title || "No Title")}</span>
                    <span class="status-pill ${status.className}">${escapeHtml(status.label)}</span>
                </div>
                <div class="asset-sub">ID: ${escapeHtml(acp.assessmentId)} &bull; ${escapeHtml(getAssessmentLifecycle(acp))} &bull; ${escapeHtml(acp.owner || "N/A")}</div>
                <div class="asset-sub date-info">${assessmentDateInfoHtml(acp)}</div>
                <div class="asset-sub status-detail">${escapeHtml(status.detail)}</div>
            </div>
        `;
        container.appendChild(row);
    });

    document.querySelectorAll(".assessment-checkbox").forEach(cb => {
        cb.addEventListener("change", (e) => {
            const id = String(e.target.dataset.id);
            if (e.target.checked && !selectedIds.includes(id)) selectedIds.push(id);
            else selectedIds = selectedIds.filter(x => x !== id);
            saveSelectedAcps(selectedIds);
            updateSelectedCount();
        });
    });
}

function updateSelectedCount() {
    $("selectedCount").textContent = `${selectedIds.length} Selected`;
    $("validateBtn").disabled = selectedIds.length === 0;
    $("reviewBtn").disabled = selectedIds.length === 0;
    $("clearSelectionBtn").disabled = selectedIds.length === 0;
}

// ==========================================
// RESULTS RENDERING — Accordion UI
// ==========================================

const STATUS_COLORS = {
    PASS: { bg: 'rgba(135,215,163,.25)', color: '#1f6b3a', icon: '✓' },
    FAIL: { bg: 'rgba(244,164,164,.35)', color: '#7a1b1b', icon: '✗' },
    ERROR: { bg: 'rgba(253,186,116,.35)', color: '#7a3a00', icon: '⚠' },
    WARNING: { bg: 'rgba(253,230,138,.35)', color: '#6b4a00', icon: '!' },
    REVIEW: { bg: 'rgba(253,230,138,.35)', color: '#6b4a00', icon: '!' },
    'N/A': { bg: 'rgba(203,213,225,.35)', color: '#475569', icon: '–' },
    CANCELLED: { bg: 'rgba(203,213,225,.25)', color: '#64748b', icon: '○' }
};

function statusBadge(status) {
    const s = STATUS_COLORS[status] || STATUS_COLORS['N/A'];
    return `<span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${s.bg};color:${s.color};">${s.icon} ${status}</span>`;
}

function renderResults(resultsMap) {
    const container = $("resultsContainer");
    container.innerHTML = "";

    if (!resultsMap || Object.keys(resultsMap).length === 0) {
        container.innerHTML = '<div class="empty-state">No validation results yet.</div>';
        $("clearValidationResultsBtn").classList.add("hidden");
        return;
    }
    $("clearValidationResultsBtn").classList.remove("hidden");

    Object.entries(resultsMap).forEach(([id, data]) => {
        const checkpoints = data.results || [];
        const pass = checkpoints.filter(r => r.status === 'PASS').length;
        const fail = checkpoints.filter(r => r.status === 'FAIL').length;
        const errors = checkpoints.filter(r => r.status === 'ERROR').length;
        const review = checkpoints.filter(r => r.status === 'REVIEW').length;
        const na = checkpoints.filter(r => r.status === 'N/A').length;
        const total = checkpoints.length;
        const title = data.title || `Assessment ${id}`;

        const card = document.createElement("div");
        card.className = "result-card";

        // Summary score bar
        const passPercent = total > 0 ? Math.round((pass / total) * 100) : 0;
        let scoreBg = passPercent >= 80 ? 'rgba(135,215,163,.35)' : passPercent >= 50 ? 'rgba(253,230,138,.35)' : 'rgba(244,164,164,.35)';
        let scoreColor = passPercent >= 80 ? '#1f6b3a' : passPercent >= 50 ? '#6b4a00' : '#7a1b1b';

        card.innerHTML = `
            <div class="result-header">
                <div>
                    <div style="font-weight:700;font-size:14px;">${escapeHtml(title)}</div>
                    <div style="font-size:11px;color:#6b7280;margin-top:2px;">Assessment ID: ${id}</div>
                </div>
                <span class="score-pill" style="background:${scoreBg};color:${scoreColor};">
                    ${pass}/${total - na} Passed
                </span>
            </div>
            <div style="display:flex;gap:8px;margin:10px 0 4px;flex-wrap:wrap;">
                <span style="font-size:12px;color:#1f6b3a;">✓ ${pass} Pass</span>
                <span style="font-size:12px;color:#7a1b1b;">✗ ${fail} Fail</span>
                ${errors > 0 ? `<span style="font-size:12px;color:#7a3a00;">⚠ ${errors} Error</span>` : ''}
                ${review > 0 ? `<span style="font-size:12px;color:#6b4a00;">! ${review} Review</span>` : ''}
                <span style="font-size:12px;color:#475569;">– ${na} N/A</span>
            </div>
            <div style="margin-top:10px; border:1px solid #e8edf5; border-radius:8px; overflow:hidden;">
                <button class="main-cp-toggle" aria-expanded="false" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#fafbff; border:none; cursor:pointer; text-align:left;">
                    <span style="font-size:13px; font-weight:700; color:#374151;">Checkpoints</span>
                    <span class="main-cp-chevron" style="color:#9ca3af; font-size:12px; transition:transform .2s;">▼</span>
                </button>
                <div class="main-cp-body" style="display:none; padding:0; background:white; border-top:1px solid #e8edf5;">
                    <div class="checkpoint-list" id="list-${id}"></div>
                </div>
            </div>
        `;

        container.appendChild(card);

        const listContainer = card.querySelector(`#list-${id}`);
        checkpoints.forEach((cp, i) => {
            const item = document.createElement("div");
            item.style.cssText = "padding:12px; border-bottom:1px solid #e8edf5;";

            const isAiError = cp.isAiError;
            const hasProblem = cp.status === 'FAIL' || cp.status === 'ERROR';

            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <span style="font-size:12px; font-weight:600; color:${hasProblem ? '#7a1b1b' : '#374151'};">
                        ${escapeHtml(cp.checkpointId)} — ${escapeHtml(cp.checkpointName || '')}
                    </span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        ${isAiError ? '<span style="font-size:10px;color:#7a3a00;font-weight:700;background:rgba(253,186,116,.3);padding:1px 6px;border-radius:4px;">AI Error</span>' : ''}
                        <span style="font-size:10px;color:#6b7280;">${cp.source || ''}</span>
                        ${statusBadge(cp.status)}
                    </div>
                </div>
                <div style="font-size:12px; color:#374151;">
                    <strong>Result:</strong> ${escapeHtml(cp.message || 'No message')}
                </div>
                ${cp.recommendation ? `<div style="font-size:12px;color:#374151;margin-top:6px;"><strong>Recommendation:</strong> ${escapeHtml(Array.isArray(cp.recommendation) ? cp.recommendation.join(' ') : cp.recommendation)}</div>` : ''}
                ${cp.requiresHumanVerification ? '<div class="analysis-meta">Human verification required</div>' : ''}
                ${cp.rawResponse ? `
                    <details style="margin-top:6px;">
                        <summary style="font-size:11px;color:#6b7280;cursor:pointer;">Raw AI Response</summary>
                        <pre style="font-size:10px;background:#f6f8fc;padding:8px;border-radius:6px;overflow-x:auto;white-space:pre-wrap;color:#374151;margin-top:4px;">${escapeHtml(cp.rawResponse)}</pre>
                    </details>
                ` : ''}
                ${isAiError ? `
                    <div style="margin-top:8px;padding:8px;background:rgba(253,186,116,.2);border-radius:8px;font-size:11px;color:#7a3a00;">
                        <strong>⚠ Boeing AI Error:</strong> The AI conversation failed for this checkpoint. Validation continued for other checkpoints. Check that boeingai.web.boeing.com is open and your session is active.
                    </div>
                ` : ''}
            `;
            listContainer.appendChild(item);
        });

        // Toggle the main accordion
        card.querySelector('.main-cp-toggle').addEventListener('click', function () {
            const body = card.querySelector('.main-cp-body');
            const chevron = card.querySelector('.main-cp-chevron');
            const isOpen = body.style.display !== 'none';
            body.style.display = isOpen ? 'none' : 'block';
            chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            this.setAttribute('aria-expanded', String(!isOpen));
        });
    });
}

function renderReviewResults(resultsMap) {
    const container = $("reviewResultsContainer");
    container.innerHTML = "";
    if (!resultsMap || !Object.keys(resultsMap).length) {
        container.innerHTML = '<div class="empty-state">No review results yet.</div>';
        $("clearReviewResultsBtn").classList.add("hidden");
        return;
    }
    $("clearReviewResultsBtn").classList.remove("hidden");
    for (const [id, data] of Object.entries(resultsMap)) {
        const summary = data.review?.summary || {};
        const questionStates = summary.questionStates || {};
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <div class="result-header"><div><strong>${escapeHtml(data.title || `Assessment ${id}`)}</strong><div class="asset-sub">Assessment ID: ${escapeHtml(id)}</div></div><span class="score-pill">${summary.questionCount || 0} Questions</span></div>
            <div class="review-summary-line">
                <span class="summary-correct">${questionStates.CORRECT || 0} correct</span>
                <span>${questionStates.PARTIAL || 0} partial</span>
                <span class="summary-problem">${(questionStates.INCORRECT || 0) + (questionStates.MISSING || 0)} issues</span>
                <span>${questionStates.NEEDS_VERIFICATION || 0} verify</span>
                <span>${summary.questionsWithSuggestions || 0} suggestions</span>
            </div>
            <div class="review-result-actions">
                <button class="btn-secondary new-questions-btn">New Questions</button>
                <button class="btn-primary review-notes-btn">Review Notes</button>
            </div>`;
        card.querySelector('.new-questions-btn').addEventListener('click', () => openNewQuestions(data.review));
        card.querySelector('.review-notes-btn').addEventListener('click', () => openReviewNotes(data.review, data.title, id));
        container.appendChild(card);
    }
}

function switchResultsTab(event) {
    updateTabSet('[data-results-tab]', event.currentTarget);
    const review = event.currentTarget.dataset.resultsTab === 'review';
    $("validationResultsPanel").classList.toggle('hidden', review);
    $("reviewResultsPanel").classList.toggle('hidden', !review);
}

function openReviewNotes(review, title, assessmentId) {
    activeReviewResult = review || {};
    activeReviewAssessmentId = assessmentId;
    activeReviewTitle = title || `Assessment ${assessmentId}`;
    $("reviewNotesTitle").textContent = `${title || 'ACP'} Review Notes`;
    $("reviewSearchInput").value = '';
    $("reviewStateFilter").value = '';
    renderActiveReviewAnalysis();
    openModal($("reviewNotesModal"));
}

function closeReviewNotes() {
    activeReviewResult = null;
    activeReviewAssessmentId = null;
    activeReviewTitle = null;
    closeModal($("reviewNotesModal"));
}

function renderActiveReviewAnalysis() {
    if (!activeReviewResult) return;
    const query = $("reviewSearchInput").value.trim().toLowerCase();
    const state = $("reviewStateFilter").value;
    const filterFindings = findings => (findings || []).map(normalizeDisplayedFinding).filter(finding => {
        if (state && finding.state !== state) return false;
        if (!query) return true;
        return JSON.stringify(finding).toLowerCase().includes(query);
    });
    const questionFindings = filterFindings(
        activeReviewResult.questionAnalysis || activeReviewResult.questionWiseAnalysis || []
    );
    renderAnalysis($("questionAnalysisPanel"), questionFindings);
    $("reviewMatchCount").textContent = `${questionFindings.length} finding${questionFindings.length === 1 ? '' : 's'}`;
}

function renderAnalysis(container, findings) {
    container.innerHTML = findings.length ? '' : '<div class="empty-state">No analysis is available.</div>';
    findings.map(normalizeDisplayedFinding).forEach(finding => {
        const item = document.createElement('details');
        item.className = 'analysis-item';
        item.open = finding.state !== 'CORRECT' && finding.state !== 'NOT_APPLICABLE';
        const hasTableAnswer = !!finding.table?.columns?.length;
        const hasFormatAwareAnswer = hasTableAnswer || ['rich_text', 'yes_no'].includes(finding.answerFormat);
        item.innerHTML = `
            <summary class="analysis-heading"><span><strong>${escapeHtml(finding.id)}</strong>${finding.name ? `<span class="analysis-title">${escapeHtml(finding.name)}</span>` : ''}</span><span class="review-state state-${String(finding.state).toLowerCase()}">${escapeHtml(finding.state)}</span></summary>
            <div class="analysis-body">
                ${renderQuestionEvidence(finding)}
                ${renderAnalysisField('What is correct', finding.whatIsCorrect)}
                ${renderAnalysisField('What is wrong or missing', finding.whatIsWrong)}
                ${renderAnalysisField('Why it matters', finding.whyItMatters)}
                ${renderAnalysisField('How to improve', finding.howToImprove)}
                ${renderAnalysisField('Evidence', finding.evidence)}
                <div class="suggestion-editor">
                    <div class="suggestion-header"><strong>${hasFormatAwareAnswer ? 'Suggested corrected answer' : 'Suggested answer'}</strong><button class="icon-btn small-icon-btn copy-suggestion-btn" title="Copy suggested answer" aria-label="Copy suggested answer">⧉</button></div>
                    ${hasTableAnswer ? `<div class="suggested-table-host">${renderSuggestedTablePanel(finding)}</div>` : ''}
                    ${finding.answerFormat === 'yes_no' ? `<div class="suggested-option-host">${renderSuggestedOption(finding.suggestedOption)}</div>` : ''}
                    ${hasTableAnswer ? '<details class="suggestion-narrative"><summary>Suggested narrative / fallback text</summary>' : ''}
                    <textarea class="suggestion-text input" rows="6" aria-label="Suggested answer" placeholder="No suggestion was generated.">${escapeHtml(finding.suggestedText || '')}</textarea>
                    ${hasTableAnswer ? '</details>' : ''}
                    <div class="fine-tune-row">
                        <input class="fine-tune-input input" type="text" aria-label="Fine-tune instruction" placeholder="Describe how to fine-tune this answer...">
                        <button class="btn-secondary fine-tune-btn">Fine-tune</button>
                    </div>
                    <div class="fine-tune-status settings-muted" aria-live="polite"></div>
                </div>
                ${renderAnalysisField('Questions for the application team', finding.questionsForApplicationTeam)}
                <div class="analysis-meta">Confidence: ${Math.round((Number(finding.confidence) || 0) * 100)}%${finding.requiresHumanVerification ? ' | Human verification required' : ''}${finding.audit?.verified ? ' | Auditor verified' : finding.audit?.error ? ' | Auditor unavailable' : ''}</div>
            </div>`;
        const suggestion = item.querySelector('.suggestion-text');
        suggestion.addEventListener('change', async () => {
            finding.suggestedText = suggestion.value;
            await persistActiveReview();
        });
        item.querySelector('.copy-suggestion-btn').addEventListener('click', event => copySuggestedAnswer(
            serializeSuggestedAnswer(finding, suggestion.value),
            event.currentTarget
        ));
        item.querySelector('.fine-tune-btn').addEventListener('click', () => fineTuneFinding(finding, item));
        container.appendChild(item);
    });
}

function normalizeDisplayedFinding(finding) {
    const state = String(finding?.state || 'NEEDS_VERIFICATION').toUpperCase();
    const normalized = {
        id: finding?.id || finding?.questionId || finding?.checkpointId || 'Unknown',
        name: finding?.name || finding?.questionText || finding?.checkpointName || '',
        state,
        whatIsCorrect: finding?.whatIsCorrect ?? finding?.what_is_correct ?? [],
        whatIsWrong: finding?.whatIsWrong ?? finding?.what_is_wrong ?? [],
        whyItMatters: finding?.whyItMatters ?? finding?.why_it_matters ?? '',
        howToImprove: finding?.howToImprove ?? finding?.how_to_improve ?? [],
        suggestedText: finding?.suggestedText ?? finding?.suggested_text ?? '',
        suggestedTable: finding?.suggestedTable ?? finding?.suggested_table ?? null,
        suggestedOption: finding?.suggestedOption ?? finding?.suggested_option ?? null,
        answerFormat: finding?.answerFormat ?? finding?.answer_format ?? null,
        requiresHumanVerification: finding?.requiresHumanVerification ?? finding?.requires_human_verification ?? true,
        questionsForApplicationTeam: finding?.questionsForApplicationTeam ?? finding?.questions_for_application_team ?? []
    };
    if (finding && typeof finding === 'object') {
        Object.assign(finding, normalized);
        return finding;
    }
    return normalized;
}

function renderQuestionEvidence(finding) {
    if (!finding.questionType && !finding.table && finding.answered === undefined) return '';
    const selected = (finding.selectedOptions || []).flatMap(option => [option.value, option.additionalText]).filter(Boolean);
    const answer = finding.answerText || selected.join('\n');
    return `
        <div class="question-evidence">
            <div class="question-evidence-meta"><span>${escapeHtml(finding.group || 'General')}</span><span>${escapeHtml(finding.questionType || 'Unknown type')}</span><span>${finding.answered ? 'Answered' : 'No recorded answer'}</span></div>
            <div class="answer-comparison-card original-answer-card">
                <div class="answer-comparison-heading"><strong>Original CAIRO answer</strong>${finding.table ? '<span>Table view</span>' : ''}</div>
                ${finding.table
                    ? `<div class="original-table-host">${renderComparisonTable(finding.table, finding.suggestedTable, 'original')}</div>`
                    : finding.answerFormat === 'yes_no'
                        ? `<div class="current-answer option-answer"><span class="answer-option-badge original-option">${escapeHtml(answer || 'No answer recorded.')}</span></div>`
                        : `<div class="current-answer rich-text-answer"><p>${escapeHtml(answer || 'No answer recorded.')}</p></div>`}
            </div>
        </div>`;
}

function renderSuggestedOption(option) {
    const normalized = String(option || 'NEEDS_VERIFICATION').toUpperCase();
    const label = normalized === 'NEEDS_VERIFICATION' ? 'Needs verification' : normalized === 'YES' ? 'Yes' : 'No';
    return `<div class="option-answer"><span class="answer-option-badge suggested-option option-${normalized.toLowerCase()}">${label}</span></div>`;
}

function renderSuggestedTablePanel(finding) {
    if (!finding.suggestedTable?.rows?.length) {
        return '<div class="structured-suggestion-empty">No structured table was returned. Use Fine-tune to ask BCAI to regenerate the complete ACP-AR1 table, or review the fallback narrative below.</div>';
    }
    return `
        <div class="table-change-legend" aria-label="Table change legend">
            <span><i class="legend-swatch changed"></i>Changed</span>
            <span><i class="legend-swatch added"></i>New row</span>
            <span><i class="legend-swatch unchanged"></i>Unchanged</span>
        </div>
        ${renderComparisonTable(finding.suggestedTable, finding.table, 'suggested')}`;
}

function renderComparisonTable(table, comparisonTable, side) {
    if (!table?.columns?.length) return '';
    const rows = table.rows || [];
    const comparisonRows = comparisonTable?.rows || [];
    const caption = side === 'suggested' ? 'Suggested corrected ACP table' : 'Original CAIRO ACP table';
    return `<div class="evidence-table-wrap"><table class="evidence-table comparison-table"><caption class="visually-hidden">${caption}</caption><thead><tr><th class="row-number-column">Row</th>${table.columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row, rowIndex) => {
        const comparisonRow = findComparisonRow(row, rowIndex, comparisonRows);
        const rowClass = !comparisonRow ? (side === 'suggested' ? 'table-row-added' : 'table-row-removed') : '';
        return `<tr class="${rowClass}"><th class="row-number-column" scope="row">${escapeHtml(String(row.rowGroupNumber ?? rowIndex + 1))}</th>${table.columns.map(column => {
            const value = getTableCellText(row, column.key);
            const comparisonValue = comparisonRow ? getTableCellText(comparisonRow, column.key) : '';
            const changed = comparisonRow && normalizeCellText(value) !== normalizeCellText(comparisonValue);
            const cellClass = changed ? 'table-cell-changed' : comparisonRow ? 'table-cell-unchanged' : '';
            return `<td class="${cellClass}">${escapeHtml(value || '—')}</td>`;
        }).join('')}</tr>`;
    }).join('')}</tbody></table></div>`;
}

function findComparisonRow(row, index, rows) {
    const group = String(row?.rowGroupNumber ?? '');
    return rows.find(candidate => String(candidate?.rowGroupNumber ?? '') === group) || rows[index] || null;
}

function getTableCellText(row, key) {
    const cell = row?.cells?.find(candidate => String(candidate?.key) === String(key));
    return (cell?.values || []).map(value => typeof value === 'object' ? value?.value : value).filter(Boolean).join(', ');
}

function normalizeCellText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function serializeSuggestedAnswer(finding, fallbackText) {
    const table = finding.suggestedTable;
    if (!table?.columns?.length || !table?.rows?.length) {
        return finding.suggestedOption
            ? [finding.suggestedOption, fallbackText].filter(Boolean).join('\n')
            : fallbackText;
    }
    const header = table.columns.map(column => column.label).join('\t');
    const rows = table.rows.map(row => table.columns.map(column => getTableCellText(row, column.key)).join('\t'));
    return [header, ...rows].join('\n');
}

async function copySuggestedAnswer(text, button) {
    if (!text.trim()) return showNotice('There is no suggested answer to copy.');
    try {
        await navigator.clipboard.writeText(text);
        const original = button.textContent;
        button.textContent = '✓';
        setTimeout(() => { button.textContent = original; }, 1200);
    } catch (error) {
        showNotice(`Unable to copy the suggested answer: ${error.message}`, { persistent: true });
    }
}

async function fineTuneFinding(finding, item) {
    const input = item.querySelector('.fine-tune-input');
    const button = item.querySelector('.fine-tune-btn');
    const status = item.querySelector('.fine-tune-status');
    const instruction = input.value.trim();
    if (!instruction) {
        status.textContent = 'Enter a short fine-tune instruction.';
        return;
    }

    button.disabled = true;
    input.disabled = true;
    status.textContent = 'Fine-tuning with BCAI...';
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'FINE_TUNE_REVIEW_SUGGESTION',
            finding,
            instruction
        });
        if (!response?.success) throw new Error(response?.error || 'Fine-tuning failed.');
        finding.suggestedText = response.suggestedText;
        finding.suggestedOption = response.suggestedOption || finding.suggestedOption || null;
        finding.suggestedTable = response.suggestedTable || finding.suggestedTable || null;
        item.querySelector('.suggestion-text').value = response.suggestedText;
        const suggestedTableHost = item.querySelector('.suggested-table-host');
        if (suggestedTableHost) suggestedTableHost.innerHTML = renderSuggestedTablePanel(finding);
        const suggestedOptionHost = item.querySelector('.suggested-option-host');
        if (suggestedOptionHost) suggestedOptionHost.innerHTML = renderSuggestedOption(finding.suggestedOption);
        const originalTableHost = item.querySelector('.original-table-host');
        if (originalTableHost) originalTableHost.innerHTML = renderComparisonTable(finding.table, finding.suggestedTable, 'original');
        input.value = '';
        status.textContent = response.changeSummary || 'Suggested answer updated.';
        await persistActiveReview();
    } catch (error) {
        status.textContent = `Unable to fine-tune: ${error.message}`;
    } finally {
        button.disabled = automationBusy;
        input.disabled = false;
    }
}

async function persistActiveReview() {
    if (!activeReviewAssessmentId || !activeReviewResult) return;
    await saveReviewResult(activeReviewAssessmentId, activeReviewResult, activeReviewTitle);
}

function renderAnalysisField(label, value) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    if (!values.length) return '';
    return `<div class="analysis-field"><strong>${label}</strong>${values.map(item => `<p>${escapeHtml(typeof item === 'string' ? item : JSON.stringify(item))}</p>`).join('')}</div>`;
}

function openNewQuestions(review) {
    const questions = review?.newQuestions || [];
    $("newQuestionsContent").innerHTML = questions.length
        ? questions.map(question => `<div class="analysis-item">${escapeHtml(typeof question === 'string' ? question : JSON.stringify(question))}</div>`).join('')
        : 'New-question generation is reserved for the next implementation phase.';
    openModal($("newQuestionsModal"));
}

// ==========================================
// ACTIONS
// ==========================================

async function loadInitialAssessmentData() {
    if (startupBehavior === 'restoreCached') {
        const cachedAcps = await getAcps();
        if (cachedAcps.length) {
            allAcps = cachedAcps;
            populateOwnerFilter();
            applyFilters();
            return;
        }
    }

    await refreshData();
}

async function refreshData() {
    const button = $("refreshBtn");
    button.disabled = true;
    button.classList.add('is-loading');
    try {
        const response = await chrome.runtime.sendMessage({ action: "LOAD_ACPS" });
        if (!response?.success) throw new Error(response?.error || 'Unknown error');
        allAcps = response.data || [];
        await saveAcps(allAcps);
        populateOwnerFilter();
        applyFilters();
        showNotice(`Loaded ${allAcps.length} assessment${allAcps.length === 1 ? '' : 's'}.`);
    } catch (error) {
        showNotice(`Unable to refresh assessments: ${error.message}`, { persistent: true });
    } finally {
        button.disabled = false;
        button.classList.remove('is-loading');
    }
}

async function startValidation() {
    const selected = allAcps.filter(x => selectedIds.includes(String(x.assessmentId)));
    if (!selected.length) return showNotice("Select at least one assessment before validating.");
    if (!await verifyPrerequisitesForOperation('validation')) return;
    setAutomationBusy(true);

    $("progressContainer").classList.remove("hidden");
    $("validateBtn").classList.add("hidden");
    $("reviewBtn").classList.add("hidden");
    $("cancelValidationBtn").classList.remove("hidden");
    resetProgressDisplay(selected.length);
    $("resultsContainer").innerHTML = "";

    try {
        const response = await chrome.runtime.sendMessage({ action: "START_VALIDATION", assessments: selected });
        if (!response?.started) throw new Error(response?.error || 'Validation did not start.');
        startPolling('validation');
    } catch (error) {
        restoreOperationControls('validation');
        $("progressContainer").classList.add('hidden');
        showNotice(`Unable to start validation: ${error.message}`, { persistent: true });
    }
}

async function startReview() {
    const selected = allAcps.filter(x => selectedIds.includes(String(x.assessmentId)));
    if (!selected.length) return showNotice("Select at least one assessment before reviewing.");
    if (!await verifyPrerequisitesForOperation('review')) return;
    setAutomationBusy(true);
    $("progressContainer").classList.remove("hidden");
    $("validateBtn").classList.add("hidden");
    $("reviewBtn").classList.add("hidden");
    $("cancelReviewBtn").classList.remove("hidden");
    resetProgressDisplay(selected.length);
    $("reviewResultsContainer").innerHTML = '<div class="empty-state">Review is running...</div>';
    try {
        const response = await chrome.runtime.sendMessage({ action: "START_REVIEW", assessments: selected });
        if (!response?.started) throw new Error(response?.error || 'Review did not start.');
        startPolling('review');
    } catch (error) {
        restoreOperationControls('review');
        $("progressContainer").classList.add('hidden');
        showNotice(`Unable to start review: ${error.message}`, { persistent: true });
    }
}

async function cancelValidation() {
    await requestCancellation('validation');
}

async function cancelReview() {
    await requestCancellation('review');
}

async function requestCancellation(mode) {
    const button = $(mode === 'review' ? "cancelReviewBtn" : "cancelValidationBtn");
    try {
        await chrome.runtime.sendMessage({ action: mode === 'review' ? "CANCEL_REVIEW" : "CANCEL_VALIDATION" });
        button.textContent = "Cancelling...";
        button.disabled = true;
    } catch (error) {
        showNotice(`Unable to cancel: ${error.message}`, { persistent: true });
    }
}

function startPolling(mode = 'validation') {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        const prefix = mode === 'review' ? 'review' : 'validation';
        const state = await chrome.storage.local.get([`${prefix}Progress`, `${prefix}Complete`, `${prefix}Error`, `${prefix}Cancelled`]);

        const progress = state[`${prefix}Progress`];
        if (progress) {
            const total = progress.total || 1;
            const completed = progress.completed || 0;
            const pct = Math.round((completed / total) * 100);

            $("progressText").textContent = progress.current || 'Working...';
            $("progressFill").style.width = `${pct}%`;
            $("progressBar").setAttribute('aria-valuenow', String(pct));
            renderProgressContext(progress);
        }

        if (state[`${prefix}Complete`]) {
            clearInterval(pollInterval);
            pollInterval = null;

            // Restore buttons
            restoreOperationControls(mode);

            if (state[`${prefix}Cancelled`]) {
                $("progressText").textContent = `${mode === 'review' ? 'Review' : 'Validation'} cancelled.`;
            } else if (state[`${prefix}Error`]) {
                $("progressText").textContent = `Error: ${state[`${prefix}Error`]}`;
            } else {
                $("progressText").textContent = `${mode === 'review' ? 'Review' : 'Validation'} complete!`;
                $("progressFill").style.width = "100%";
                $("progressBar").setAttribute('aria-valuenow', '100');
            }

            // Load and render the results
            if (mode === 'review') renderReviewResults(await getAllReviewResults());
            else renderResults(await getAllResults());
            activateResultsTab(mode);
        }
    }, 800);
}

function restoreOperationControls(mode) {
    $("validateBtn").classList.remove("hidden");
    $("reviewBtn").classList.remove("hidden");
    setAutomationBusy(false);
    const cancelButton = $(mode === 'review' ? "cancelReviewBtn" : "cancelValidationBtn");
    cancelButton.classList.add("hidden");
    cancelButton.textContent = mode === 'review' ? "Cancel Review" : "Cancel Validation";
    cancelButton.disabled = false;
}

function activateResultsTab(mode) {
    const review = mode === 'review';
    const button = $(review ? 'reviewResultsTab' : 'validationResultsTab');
    updateTabSet('[data-results-tab]', button);
    $("validationResultsPanel").classList.toggle('hidden', review);
    $("reviewResultsPanel").classList.toggle('hidden', !review);
}

async function resumeActiveOperation() {
    const state = await chrome.storage.local.get([
        'validationProgress', 'validationComplete',
        'reviewProgress', 'reviewComplete'
    ]);
    const mode = state.reviewProgress && state.reviewComplete === false
        ? 'review'
        : state.validationProgress && state.validationComplete === false
            ? 'validation'
            : null;
    if (!mode) return;

    const progress = state[`${mode}Progress`];
    $("progressContainer").classList.remove('hidden');
    $("validateBtn").classList.add('hidden');
    $("reviewBtn").classList.add('hidden');
    setAutomationBusy(true);
    $(mode === 'review' ? "cancelReviewBtn" : "cancelValidationBtn").classList.remove('hidden');
    $("progressText").textContent = progress.current || 'Working...';
    const pct = Math.round(((progress.completed || 0) / (progress.total || 1)) * 100);
    $("progressFill").style.width = `${pct}%`;
    $("progressBar").setAttribute('aria-valuenow', String(pct));
    renderProgressContext(progress);
    startPolling(mode);
}

function resetProgressDisplay(total) {
    $("progressText").textContent = 'Starting...';
    $("progressCount").textContent = `0 of ${total} completed`;
    $("progressElapsed").textContent = 'Time elapsed: 0s';
    $("progressRemaining").textContent = 'Estimated remaining: Calculating...';
    $("progressFill").style.width = '0%';
    $("progressBar").setAttribute('aria-valuenow', '0');
}

function renderProgressContext(progress) {
    const completed = Number(progress.completed) || 0;
    const total = Number(progress.total) || 0;
    const elapsedMs = Math.max(0, Date.now() - (Number(progress.startedAt) || Date.now()));
    const remainingMs = completed > 0 && completed < total
        ? (elapsedMs / completed) * (total - completed)
        : completed >= total && total > 0 ? 0 : null;

    $("progressCount").textContent = `${completed} of ${total} ${progress.mode === 'review' ? 'reviewed' : 'validated'}`;
    $("progressElapsed").textContent = `Time elapsed: ${formatDuration(elapsedMs)}`;
    $("progressRemaining").textContent = `Estimated remaining: ${remainingMs == null ? 'Calculating...' : formatDuration(remainingMs)}`;
}

function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

async function loadExistingResults() {
    const results = await getAllResults();
    if (Object.keys(results).length > 0) {
        renderResults(results);
    }
    renderReviewResults(await getAllReviewResults());
}

// ==========================================
// HELPERS
// ==========================================

function applyFilters() {
    const searchPattern = getAssessmentSearchPattern();
    filteredAcps = searchPattern
        ? allAcps.filter(acp => searchPattern.test(getAssessmentSearchText(acp)))
        : [...allAcps];
    const status = $("assessmentStatusFilter").value;
    if (status) filteredAcps = filteredAcps.filter(a => a.status === status);

    if (selectedApplicationOwner) {
        filteredAcps = filteredAcps.filter(a => a.owner === selectedApplicationOwner);
    } else {
        const ownerPattern = getOwnerSearchPattern();
        if (ownerPattern) filteredAcps = filteredAcps.filter(a => ownerPattern.test(a.owner || ''));
    }

    const startDate = $("dateStartFilter").value ? new Date($("dateStartFilter").value) : null;
    const endDate = $("dateEndFilter").value ? new Date($("dateEndFilter").value) : null;
    const dateField = $("dateFilterField").value || 'date';

    if (startDate || endDate) {
        filteredAcps = filteredAcps.filter(a => {
            if (!a[dateField]) return false;
            const aDate = new Date(a[dateField]);
            if (Number.isNaN(aDate.getTime())) return false;
            if (startDate && aDate < startDate) return false;
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (aDate > end) return false;
            }
            return true;
        });
    }

    renderAssessments();
}

function clearFilters() {
    $("searchInput").value = "";
    $("regexMode").checked = false;
    $("searchInput").removeAttribute('aria-invalid');
    $("assessmentStatusFilter").value = "";
    $("ownerSearchInput").value = "";
    $("dateFilterField").value = "date";
    $("dateStartFilter").value = "";
    $("dateEndFilter").value = "";
    selectedApplicationOwner = '';
    updateOwnerOptions();
    hideOwnerOptions();
    filteredAcps = [...allAcps];
    renderAssessments();
}

async function clearValidationResultsAndUI() {
    await clearResults();
    $("resultsContainer").innerHTML = '<div class="empty-state">No validation results yet.</div>';
    $("clearValidationResultsBtn").classList.add("hidden");
    showNotice('Validation results cleared.');
}

async function clearReviewResultsAndUI() {
    await clearReviewResults();
    $("reviewResultsContainer").innerHTML = '<div class="empty-state">No review results yet.</div>';
    $("clearReviewResultsBtn").classList.add("hidden");
    showNotice('Review results cleared.');
}

function showNotice(message, { persistent = false } = {}) {
    const notice = $("uiNotice");
    notice.textContent = message;
    notice.classList.remove('hidden');
    if (noticeTimer) clearTimeout(noticeTimer);
    if (!persistent) noticeTimer = setTimeout(() => notice.classList.add('hidden'), 3500);
}

function setAutomationBusy(busy) {
    automationBusy = busy;
    const controlIds = [
        'refreshBtn', 'checkPrereqBtn', 'selectAllBtn', 'clearSelectionBtn',
        'searchInput', 'regexMode', 'dateFilterField', 'assessmentStatusFilter',
        'ownerSearchInput', 'dateStartFilter', 'dateEndFilter', 'clearFiltersBtn',
        'clearValidationResultsBtn', 'clearReviewResultsBtn'
    ];
    controlIds.forEach(id => { const element = $(id); if (element) element.disabled = busy; });
    document.querySelectorAll('.assessment-checkbox').forEach(checkbox => { checkbox.disabled = busy; });
    if (!busy) updateSelectedCount();
}

function updateTabSet(selector, activeButton) {
    document.querySelectorAll(selector).forEach(button => {
        const active = button === activeButton;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
    });
}

function handleTabKeydown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex < 0) return;
    event.preventDefault();
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
}

function openModal(modal) {
    lastFocusedElement = document.activeElement;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => modal.querySelector('.modal-panel')?.focus());
}

function closeModal(modal) {
    modal.classList.add('hidden');
    if (!document.querySelector('.modal-backdrop:not(.hidden)')) document.body.classList.remove('modal-open');
    if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
    lastFocusedElement = null;
}

function handleGlobalKeydown(event) {
    const modal = document.querySelector('.modal-backdrop:not(.hidden)');
    if (!modal) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        if (modal === $("reviewNotesModal")) closeReviewNotes();
        else if (modal === $("settingsModal")) closeSettingsModal();
        else closeModal(modal);
        return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

async function checkPrereqSessions() {
    const button = $("checkPrereqBtn");
    button.disabled = true;
    button.textContent = 'Checking...';
    document.querySelectorAll('.prereq-item .signal').forEach(signal => signal.className = 'signal signal-checking');
    try {
        const resp = await chrome.runtime.sendMessage({ action: "CHECK_PREREQUISITES" });
        if (!resp?.prerequisites) throw new Error('Session check returned no result.');
        let allPassed = true;
        resp.prerequisites.checks.forEach(check => {
            const el = document.querySelector(`.prereq-item[data-site="${check.id}"] .signal`);
            if (el) el.className = `signal ${check.passed ? "signal-pass" : "signal-fail"}`;

            const smallText = document.querySelector(`.prereq-item[data-site="${check.id}"] small`);
            if (smallText) {
                smallText.textContent = check.passed ? "Checked" : (check.message || "Requires sign-on");
            }
            if (!check.passed) allPassed = false;
        });

        const summary = document.getElementById("prereqSummary");
        if (summary) {
            summary.textContent = allPassed ? "All prerequisites satisfied." : "Some prerequisites are missing.";
            summary.style.color = allPassed ? "inherit" : "#e53e3e";
        }
        return allPassed;
    } catch (error) {
        showNotice(`Unable to check sessions: ${error.message}`, { persistent: true });
        document.querySelectorAll('.prereq-item .signal').forEach(signal => signal.className = 'signal signal-unknown');
        return false;
    } finally {
        button.disabled = automationBusy;
        button.textContent = 'Check Sessions';
    }
}

async function verifyPrerequisitesForOperation(mode) {
    showNotice(`Checking prerequisites before ${mode}...`, { persistent: true });
    const passed = await checkPrereqSessions();
    if (!passed) {
        showNotice(`Cannot start ${mode}. Open Cairo and Boeing AI, sign in, then try again.`, { persistent: true });
        return false;
    }
    showNotice(`Prerequisites verified. Starting ${mode}...`);
    return true;
}

function handleSelectAll() {
    selectedIds = filteredAcps.map(a => String(a.assessmentId));
    saveSelectedAcps(selectedIds);
    renderAssessments();
    updateSelectedCount();
}

function handleClearSelection() {
    selectedIds = [];
    saveSelectedAcps(selectedIds);
    renderAssessments();
    updateSelectedCount();
}

function populateOwnerFilter() {
    applicationOwners = [...new Set(allAcps.map(a => a.owner))].filter(Boolean).sort((a, b) => a.localeCompare(b));
    if (selectedApplicationOwner && !applicationOwners.includes(selectedApplicationOwner)) {
        selectedApplicationOwner = '';
        $("ownerSearchInput").value = '';
    }
    updateOwnerOptions();
}

function renderOwnerOptions(owners) {
    const container = $("ownerOptions");
    container.innerHTML = '';
    const options = [{ value: '', label: 'All Application Owners' }, ...owners.map(owner => ({ value: owner, label: owner }))];
    options.forEach(({ value, label }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'manager-option';
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(value === selectedApplicationOwner));
        button.textContent = label;
        button.addEventListener('click', () => selectApplicationOwner(value));
        container.appendChild(button);
    });
}

function selectApplicationOwner(owner) {
    selectedApplicationOwner = owner;
    $("ownerSearchInput").value = owner;
    hideOwnerOptions();
    applyFilters();
}

function getOwnerSearchPattern() {
    const value = $("ownerSearchInput").value.trim();
    if (!value) return null;
    try { return new RegExp(value, 'i'); } catch { return new RegExp(escapeRegExp(value), 'i'); }
}

function updateOwnerOptions() {
    const pattern = getOwnerSearchPattern();
    renderOwnerOptions(pattern ? applicationOwners.filter(owner => pattern.test(owner)) : applicationOwners);
}

function showOwnerOptions() {
    updateOwnerOptions();
    $("ownerOptions").classList.remove('hidden');
    $("ownerSearchInput").setAttribute('aria-expanded', 'true');
}

function hideOwnerOptions() {
    $("ownerOptions").classList.add('hidden');
    $("ownerSearchInput").setAttribute('aria-expanded', 'false');
}

function handleOwnerSearchKeydown(event) {
    if (event.key === 'Escape') return hideOwnerOptions();
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        showOwnerOptions();
        $("ownerOptions").querySelector('.manager-option')?.focus();
    }
}

function handleOwnerOptionKeydown(event) {
    const options = [...$("ownerOptions").querySelectorAll('.manager-option')];
    const activeIndex = options.indexOf(document.activeElement);
    if (activeIndex < 0) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        hideOwnerOptions();
        $("ownerSearchInput").focus();
        return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = activeIndex;
    if (event.key === 'ArrowDown') nextIndex = Math.min(activeIndex + 1, options.length - 1);
    if (event.key === 'ArrowUp') nextIndex = Math.max(activeIndex - 1, 0);
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = options.length - 1;
    options[nextIndex]?.focus();
}

function getAssessmentSearchPattern() {
    const value = $("searchInput").value.trim();
    if (!value) {
        $("searchInput").removeAttribute('aria-invalid');
        return null;
    }
    try {
        const pattern = new RegExp($("regexMode").checked ? value : escapeRegExp(value), 'i');
        $("searchInput").removeAttribute('aria-invalid');
        return pattern;
    } catch {
        $("searchInput").setAttribute('aria-invalid', 'true');
        return /$a/;
    }
}

function getAssessmentSearchText(acp) {
    return [acp.assessmentId, acp.title, acp.owner, acp.status, getAssessmentLifecycle(acp)].filter(Boolean).join(' ');
}

function getAssessmentLifecycle(acp) {
    return acp.raw?.lifeCycle || acp.raw?.lifecycle || acp.raw?.assessmentLifeCycle || acp.status || 'N/A';
}

function assessmentDateInfoHtml(acp) {
    const dueOn = formatDate(acp.dueDate) || 'N/A';
    if (acp.status === 'Incomplete') {
        return `<strong>Incomplete initiated date:</strong> ${escapeHtml(formatDate(acp.date) || 'N/A')} &bull; <strong>Due on:</strong> ${escapeHtml(dueOn)}`;
    }
    return `<strong>Due on:</strong> ${escapeHtml(dueOn)} &bull; <strong>Survey Completed (Last):</strong> ${escapeHtml(formatDate(acp.date) || 'N/A')}`;
}

function getAssessmentStatus(acp) {
    if (acp.status === 'Incomplete') {
        const initiatedBy = acp.raw?.incompleteInitiatedByName || acp.owner || 'N/A';
        return { label: 'Incomplete', className: 'status-incomplete', detail: `Incomplete mark - Initiated by ${initiatedBy}${acp.date ? ` - ${formatDate(acp.date)}` : ''}` };
    }
    const attestedBy = acp.raw?.attestName || acp.owner || 'N/A';
    return { label: acp.status || 'Completed', className: `status-${(acp.status || 'completed').toLowerCase()}`, detail: `Attested by ${attestedBy}${acp.date ? ` - ${formatDate(acp.date)}` : ''}` };
}

function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
