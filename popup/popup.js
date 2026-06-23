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
     allAcps = await getAcps();
     selectedIds = await getSelectedAcps();
     filteredAcps = [...allAcps];
 
     attachEvents();
     renderAssessments();
     populateOwnerFilter();
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
         row.innerHTML = `
             <input type="checkbox" class="assessment-checkbox" data-id="${acp.assessmentId}" ${selectedIds.includes(acp.assessmentId) ? "checked" : ""}>
             <div class="assessment-meta">
                 <div class="asset-name">${acp.title || "No Title"}</div>
                 <div class="asset-sub">ID: ${acp.assessmentId} | Owner: ${acp.owner || "N/A"}</div>
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
    if (response.success) {
        allAcps = response.data;
        // Save to storage if needed
        await saveAcps(allAcps); 
        applyFilters();
    } else {
        alert("Failed to load: " + response.error);
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
     
     renderAssessments();
 }
 
 function clearFilters() {
     $("searchInput").value = "";
     $("assessmentStatusFilter").value = "";
     $("ownerFilter").value = "";
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
     selectedIds = selectAll(filteredAcps);
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
     owners.forEach(o => {
         const opt = document.createElement("option");
         opt.value = o; opt.textContent = o;
         select.appendChild(opt);
     });
 }