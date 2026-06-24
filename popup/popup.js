/**
 * popup/popup.js
 * Integrated ACP Validator - UI Logic
 */

import { getAcps, saveAcps, getSelectedAcps, saveSelectedAcps, getAllResults, clearResults } from "../storage/storage.js";
import { searchAcps } from "./popupUtils.js";

let allAcps = [];
let filteredAcps = [];
let selectedIds = [];
let pollInterval = null;

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    // 1. Check prerequisites automatically
    checkPrereqSessions();
    // 2. Load existing selections
    selectedIds = await getSelectedAcps();
    // 3. Fetch primary data
    await refreshData();
    attachEvents();
    updateSelectedCount();
    loadExistingResults();
}

function attachEvents() {
    $("refreshBtn").addEventListener("click", refreshData);
    $("checkPrereqBtn").addEventListener("click", checkPrereqSessions);
    $("selectAllBtn").addEventListener("click", handleSelectAll);
    $("clearSelectionBtn").addEventListener("click", handleClearSelection);
    $("validateBtn").addEventListener("click", startValidation);
    $("cancelBtn").addEventListener("click", cancelValidation);
    $("clearFiltersBtn").addEventListener("click", clearFilters);
    $("clearResultsBtn").addEventListener("click", clearResultsAndUI);

    $("searchInput").addEventListener("input", applyFilters);
    $("assessmentStatusFilter").addEventListener("change", applyFilters);
    $("ownerFilter").addEventListener("change", applyFilters);
    $("dateStartFilter").addEventListener("change", applyFilters);
    $("dateEndFilter").addEventListener("change", applyFilters);
}

// ==========================================
// RENDERERS
// ==========================================

function renderAssessments() {
    const container = $("assessmentList");
    container.innerHTML = "";

    filteredAcps.forEach(acp => {
        const row = document.createElement("div");
        row.className = "assessment-row";
        const dateLabel = acp.status === 'Completed'
            ? `Completed: ${acp.date ? new Date(acp.date).toLocaleDateString() : 'N/A'}`
            : `Initiated: ${acp.date ? new Date(acp.date).toLocaleDateString() : 'N/A'} | Due: ${acp.dueDate ? new Date(acp.dueDate).toLocaleDateString() : 'N/A'}`;

        row.innerHTML = `
            <input type="checkbox" class="assessment-checkbox" data-id="${acp.assessmentId}" ${selectedIds.includes(acp.assessmentId) ? "checked" : ""}>
            <div class="assessment-meta">
                <div class="asset-name">${acp.title || "No Title"}</div>
                <div class="asset-sub">ID: ${acp.assessmentId} | Owner: ${acp.owner || "N/A"}</div>
                <div class="asset-details" style="font-size: 0.85em; color: #666; margin-top: 2px;">
                    ${dateLabel}
                </div>
            </div>
            <div class="status-pill status-${acp.status?.toLowerCase() || 'pending'}">${acp.status || 'Pending'}</div>
        `;
        container.appendChild(row);
    });

    document.querySelectorAll(".assessment-checkbox").forEach(cb => {
        cb.addEventListener("change", (e) => {
            const id = Number(e.target.dataset.id);
            if (e.target.checked) selectedIds.push(id);
            else selectedIds = selectedIds.filter(x => x !== id);
            saveSelectedAcps(selectedIds);
            updateSelectedCount();
        });
    });
}

function updateSelectedCount() {
    $("selectedCount").textContent = `${selectedIds.length} Selected`;
}

// ==========================================
// RESULTS RENDERING — Accordion UI
// ==========================================

const STATUS_COLORS = {
    PASS: { bg: 'rgba(135,215,163,.25)', color: '#1f6b3a', icon: '✓' },
    FAIL: { bg: 'rgba(244,164,164,.35)', color: '#7a1b1b', icon: '✗' },
    ERROR: { bg: 'rgba(253,186,116,.35)', color: '#7a3a00', icon: '⚠' },
    WARNING: { bg: 'rgba(253,230,138,.35)', color: '#6b4a00', icon: '!' },
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
        $("clearResultsBtn").classList.add("hidden");
        return;
    }
    $("clearResultsBtn").classList.remove("hidden");

    Object.entries(resultsMap).forEach(([id, data]) => {
        const checkpoints = data.results || [];
        const pass = checkpoints.filter(r => r.status === 'PASS').length;
        const fail = checkpoints.filter(r => r.status === 'FAIL').length;
        const errors = checkpoints.filter(r => r.status === 'ERROR').length;
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
                <span style="font-size:12px;color:#475569;">– ${na} N/A</span>
            </div>
            <div style="margin-top:10px; border:1px solid #e8edf5; border-radius:10px; overflow:hidden;">
                <button class="main-cp-toggle" style="width:100%; display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#fafbff; border:none; cursor:pointer; text-align:left;">
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
        });
    });
}

// ==========================================
// ACTIONS
// ==========================================

async function refreshData() {
    const response = await chrome.runtime.sendMessage({ action: "LOAD_ACPS" });
    if (response && response.success) {
        allAcps = response.data || [];
        await saveAcps(allAcps);
        populateOwnerFilter();
        applyFilters();
    } else {
        alert("Failed to load: " + (response ? response.error : "Unknown error"));
    }
}

async function startValidation() {
    const selected = allAcps.filter(x => selectedIds.includes(x.assessmentId));
    if (!selected.length) return alert("Select assessments first.");

    $("progressContainer").classList.remove("hidden");
    $("validateBtn").classList.add("hidden");
    $("cancelBtn").classList.remove("hidden");
    $("resultsContainer").innerHTML = "";

    await chrome.runtime.sendMessage({ action: "START_VALIDATION", assessments: selected });

    // Start polling for progress updates
    startPolling();
}

async function cancelValidation() {
    await chrome.runtime.sendMessage({ action: "CANCEL_VALIDATION" });
    $("cancelBtn").textContent = "Cancelling...";
    $("cancelBtn").disabled = true;
}

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        const state = await chrome.storage.local.get([
            'validationProgress',
            'validationComplete',
            'validationError',
            'validationCancelled'
        ]);

        const progress = state.validationProgress;
        if (progress) {
            const total = progress.total || 1;
            const completed = progress.completed || 0;
            const pct = Math.round((completed / total) * 100);

            $("progressText").textContent = progress.current || 'Working...';
            $("progressFill").style.width = `${pct}%`;
        }

        if (state.validationComplete) {
            clearInterval(pollInterval);
            pollInterval = null;

            // Restore buttons
            $("validateBtn").classList.remove("hidden");
            $("cancelBtn").classList.add("hidden");
            $("cancelBtn").textContent = "Cancel Validation";
            $("cancelBtn").disabled = false;

            if (state.validationCancelled) {
                $("progressText").textContent = "Validation cancelled.";
            } else if (state.validationError) {
                $("progressText").textContent = `Error: ${state.validationError}`;
            } else {
                $("progressText").textContent = "Validation complete!";
                $("progressFill").style.width = "100%";
            }

            // Load and render the results
            const results = await getAllResults();
            if (Object.keys(results).length > 0) {
                renderResults(results);
            }
        }
    }, 800);
}

async function loadExistingResults() {
    const results = await getAllResults();
    if (Object.keys(results).length > 0) {
        renderResults(results);
    }
}

// ==========================================
// HELPERS
// ==========================================

function applyFilters() {
    filteredAcps = searchAcps(allAcps, $("searchInput").value);
    const status = $("assessmentStatusFilter").value;
    if (status) filteredAcps = filteredAcps.filter(a => a.status === status);

    const owner = $("ownerFilter").value;
    if (owner) filteredAcps = filteredAcps.filter(a => a.owner === owner);

    const startDate = $("dateStartFilter").value ? new Date($("dateStartFilter").value) : null;
    const endDate = $("dateEndFilter").value ? new Date($("dateEndFilter").value) : null;

    if (startDate || endDate) {
        filteredAcps = filteredAcps.filter(a => {
            if (!a.date) return false;
            const aDate = new Date(a.date);
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
    $("assessmentStatusFilter").value = "";
    $("ownerFilter").value = "";
    $("dateStartFilter").value = "";
    $("dateEndFilter").value = "";
    filteredAcps = [...allAcps];
    renderAssessments();
}

async function clearResultsAndUI() {
    await clearResults();
    $("resultsContainer").innerHTML = "";
    $("clearResultsBtn").classList.add("hidden");
}

async function checkPrereqSessions() {
    const resp = await chrome.runtime.sendMessage({ action: "CHECK_PREREQUISITES" });
    if (resp?.prerequisites) {
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
    }
}

function handleSelectAll() {
    selectedIds = filteredAcps.map(a => a.assessmentId);
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
    const owners = [...new Set(allAcps.map(a => a.owner))].filter(Boolean);
    const select = $("ownerFilter");
    select.innerHTML = '<option value="">All Owners</option>';
    owners.forEach(o => {
        const opt = document.createElement("option");
        opt.value = o; opt.textContent = o;
        select.appendChild(opt);
    });
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}