/**
 * popup/popupUtils.js
 * Utility functions shared within the popup UI layer.
 */

// ============================================================
// Dashboard Renderer
// ============================================================

export function renderDashboard(metrics) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    set('totalAcps',     metrics.total);
    set('pendingAcps',   metrics.pending);
    set('completedAcps', metrics.completed);
    set('failedAcps',    metrics.failed);
}

// ============================================================
// Filter
// ============================================================

export function filterAcps(acps, filters) {
    return acps.filter(acp => {
        if (filters.status && acp.status !== filters.status) return false;
        if (filters.owner  && acp.owner  !== filters.owner)  return false;
        return true;
    });
}

// ============================================================
// Metrics Calculator
// ============================================================

export function calculateMetrics(acps) {
    const metrics = { total: acps.length, pending: 0, completed: 0, failed: 0 };
    for (const acp of acps) {
        if (acp.status === 'Pending')   metrics.pending++;
        else if (acp.status === 'Completed') metrics.completed++;
        else if (acp.status === 'Failed')    metrics.failed++;
    }
    return metrics;
}

// ============================================================
// Search
// ============================================================

export function searchAcps(acps, searchTerm) {
    if (!searchTerm) return acps;
    const term = searchTerm.toLowerCase().trim();
    return acps.filter(acp =>
        String(acp.assessmentId).includes(term) ||
        (acp.title  || '').toLowerCase().includes(term) ||
        (acp.owner  || '').toLowerCase().includes(term)
    );
}
