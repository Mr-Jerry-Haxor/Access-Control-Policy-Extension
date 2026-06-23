/**
 * popup/popup.js
 * Integrated ACP Validator - UI Logic
 */

 import { getAcps, saveAcps, getSelectedAcps, saveSelectedAcps, getAllResults, clearResults } from "../storage/storage.js";
 import { loadAcps, toggleSelection, selectAll, clearSelection, getSelectedIds } from "../core/assessment.js";
 import { buildContexts } from "../core/context.js";
 import { filterAcps, searchAcps } from "./popupUtils.js";
 
 let allAcps = [];
 let filteredAcps = [];
 let selectedIds = [];
 
 const $ = id => document.getElementById(id);
 
 document.addEventListener("DOMContentLoaded", initialize);
 
 async function initialize() {
    // 1. Check prerequisites automatically
    checkPrereqSessions();

    // 2. Load existing selections
    selectedIds = await getSelectedAcps();

    // 3. Fetch the primary data URL automatically
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
 
     // Re-bind checkboxes
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
 // ACTIONS
 // ==========================================
 
 async function refreshData() {
    // Call the Service Worker instead of the local function
    const response = await chrome.runtime.sendMessage({ action: "LOAD_ACPS" });
    if (response && response.success) {
        allAcps = response.data || [];
        // Save to storage if needed
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
 
     // Communicate with Background
     await chrome.runtime.sendMessage({ action: "START_VALIDATION", assessments: selected });
 }
 
 async function loadExistingResults() {
     const results = await getAllResults();
     if (Object.keys(results).length > 0) {
         renderResults(results);
     }
 }
 
 function renderResults(resultsMap) {
     const container = $("resultsContainer");
     container.innerHTML = "";
     $("clearResultsBtn").classList.remove("hidden");
 
     Object.entries(resultsMap).forEach(([id, data]) => {
         const card = document.createElement("div");
         card.className = "result-card";
         card.innerHTML = `
             <div class="result-header"><strong>Assessment ${id}</strong></div>
             <div class="result-meta">${data.results.length} checkpoints processed.</div>
         `;
         container.appendChild(card);
     });
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
                 // Set end date to end of day
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
         resp.prerequisites.checks.forEach(check => {
             const el = document.querySelector(`.prereq-item[data-site="${check.id}"] .signal`);
             if (el) el.className = `signal ${check.passed ? "signal-pass" : "signal-fail"}`;
         });
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