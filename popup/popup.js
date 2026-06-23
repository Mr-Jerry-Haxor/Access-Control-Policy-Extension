/**
 * popup/popup.js
 * Main entry point for the ACP Validator extension popup.
 */

import { loadAcps, validateAssessments, selectAll, toggleSelection, getSelectedIds } from '../core/assessment.js';
import { buildContexts } from '../core/context.js';
import { searchAcps, filterAcps, calculateMetrics, renderDashboard } from './popupUtils.js';

// ============================================================
// State
// ============================================================

let allAcps = [];

// ============================================================
// DOM References
// ============================================================

const $ = id => document.getElementById(id);

const statusDot  = $('statusDot');
const statusText = $('statusText');
const spinner    = $('spinner');
const results    = $('results');
const searchInput  = $('searchInput');
const statusFilter = $('statusFilter');

// ============================================================
// Status Bar Helpers
// ============================================================

function setStatus(message, state = 'idle') {
    statusText.textContent = message;

    statusDot.className = 'status-dot';
    spinner.className   = 'spinner';

    if (state === 'loading') {
        statusDot.classList.add('loading');
        spinner.classList.add('active');
    } else if (state === 'error') {
        statusDot.classList.add('error');
    }
    // 'idle' = default green pulse, no changes needed
}

function setLoading(message) { setStatus(message, 'loading'); }
function setIdle(message)    { setStatus(message, 'idle'); }
function setError(message)   { setStatus(message, 'error'); }

// ============================================================
// Load ACPs
// ============================================================

$('loadBtn').addEventListener('click', async () => {
    try {
        setLoading('Loading ACPs...');
        allAcps = await loadAcps();
        setIdle(`${allAcps.length} ACPs loaded`);
        render();
    } catch (err) {
        console.error('[ACP] Load failed:', err);
        setError(err.message);
    }
});

// ============================================================
// Select All
// ============================================================

$('selectAllBtn').addEventListener('click', () => {
    if (!allAcps.length) {
        setError('Load ACPs first.');
        return;
    }
    selectAll(allAcps);
    render();
    setIdle(`${allAcps.length} ACPs selected`);
});

// ============================================================
// Build Contexts
// ============================================================

$('buildContextBtn').addEventListener('click', async () => {
    if (!allAcps.length) {
        setError('Load ACPs first.');
        return;
    }
    try {
        setLoading('Building contexts...');
        const targets = getTargetAcps();
        const contexts = await buildContexts(targets);
        setIdle(`${contexts.length} contexts built`);
    } catch (err) {
        console.error('[ACP] Context build failed:', err);
        setError(err.message);
    }
});

// ============================================================
// Validate ACPs
// ============================================================

$('validateBtn').addEventListener('click', async () => {
    if (!allAcps.length) {
        setError('Load ACPs first.');
        return;
    }
    try {
        setLoading('Building contexts...');
        const targets  = getTargetAcps();
        const contexts = await buildContexts(targets);

        setLoading(`Validating ${contexts.length} assessments...`);
        const validationResults = await validateAssessments(contexts);

        setIdle(`${validationResults.length} assessments validated`);
        console.info('[ACP] Validation results:', validationResults);

    } catch (err) {
        console.error('[ACP] Validation failed:', err);
        setError(err.message);
    }
});

// ============================================================
// Search & Filter
// ============================================================

searchInput.addEventListener('input', render);
statusFilter.addEventListener('change', render);

// ============================================================
// Render Pipeline
// ============================================================

function getTargetAcps() {
    const ids = getSelectedIds();
    return ids.length > 0
        ? allAcps.filter(acp => ids.includes(acp.assessmentId))
        : allAcps;
}

function render() {
    let filtered = searchAcps(allAcps, searchInput.value);
    filtered = filterAcps(filtered, { status: statusFilter.value });

    const metrics = calculateMetrics(filtered);
    renderDashboard(metrics);
    renderTable(filtered);
}

function renderTable(acps) {
    results.innerHTML = '';

    if (!acps.length) {
        results.innerHTML = `
            <div class="empty-state">
                <svg class="empty-icon" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.5"
                     stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                    <rect x="9" y="3" width="6" height="4" rx="1" ry="1"/>
                </svg>
                <p>${allAcps.length === 0 ? 'No ACPs loaded yet.' : 'No ACPs match your filters.'}</p>
                <span class="hint">${allAcps.length === 0 ? 'Click "Load ACPs" to get started.' : 'Try clearing the search or filter.'}</span>
            </div>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    acps.forEach((acp, i) => {
        const row = document.createElement('div');
        row.className = 'acp-row';
        row.style.animationDelay = `${i * 0.02}s`;

        const statusClass = getStatusClass(acp.status);
        row.innerHTML = `
            <input type="checkbox"
                   class="acp-checkbox"
                   data-id="${escapeHtml(String(acp.assessmentId))}"
                   id="chk-${escapeHtml(String(acp.assessmentId))}">
            <div class="acp-id">${escapeHtml(String(acp.assessmentId))}</div>
            <div class="acp-title">${escapeHtml(acp.title || '—')}</div>
            <div class="acp-owner">${escapeHtml(acp.owner || '—')}</div>
            <div class="acp-status ${statusClass}">${escapeHtml(acp.status || 'Unknown')}</div>`;

        row.querySelector('.acp-checkbox').addEventListener('change', () => {
            toggleSelection(acp.assessmentId);
        });

        fragment.appendChild(row);
    });

    results.appendChild(fragment);
}

function getStatusClass(status) {
    switch (status) {
        case 'Pending':   return 'status-pending';
        case 'Completed': return 'status-completed';
        case 'Failed':    return 'status-failed';
        default:          return '';
    }
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}