/**
 * service_worker.js
 * Background service worker for the ACP Validator extension.
 */

 import { validateContexts } from './core/validation.js';
 import { saveResults, clearResults } from './storage/storage.js';
 import { getACPList } from './api/apiClient.js'; // Import your loader
 
 chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Service Worker received message:", request);
    
     // Consolidated handling
     switch (request.action || request.type) {
         
         case "CHECK_PREREQUISITES":
             checkSessions().then(sendResponse);
             return true;
 
         case "START_VALIDATION":
             runValidationBatch(request.assessments);
             return true;
 
         case "CLEAR_RESULTS":
             clearResults().then(sendResponse);
             return true;
 
         case "LOAD_ACPS":
             getACPList()
                 .then(data => sendResponse({ success: true, data }))
                 .catch(err => sendResponse({ success: false, error: err.message }));
             return true;
     }
 });
 
 async function checkSessions() {
     const sites = [
         { id: 'cairo', url: 'https://cairois.web.boeing.com/' },
         { id: 'boeingai', url: 'https://boeingai.web.boeing.com/' }
     ];
     
     const checks = await Promise.all(sites.map(async (site) => {
         try {
             // Using HEAD request to verify session without loading full page
             const res = await fetch(site.url, { method: 'HEAD', credentials: 'include' });
             return { id: site.id, passed: res.ok, message: res.statusText, finalUrl: site.url };
         } catch (err) {
             return { id: site.id, passed: false, message: 'Auth/Connection Error', finalUrl: site.url };
         }
     }));
     return { success: true, prerequisites: { checks } };
 }
 
 async function runValidationBatch(assessments) {
     let completed = 0;
     const total = assessments.length;
 
     // Reset progress
     await chrome.storage.local.set({ 
         validationProgress: { completed: 0, total, current: 'Starting...' },
         validationComplete: false 
     });
 
     try {
         const results = await validateContexts(assessments); // From your core/validation.js
         
         for (const res of results) {
             await saveResults(res.assessmentId, res.results);
             completed++;
             await chrome.storage.local.set({ 
                 validationProgress: { completed, total, current: `Processed ${res.assessmentId}` } 
             });
         }
         
         await chrome.storage.local.set({ validationComplete: true, validationResults: results });
     } catch (err) {
         await chrome.storage.local.set({ validationError: err.message });
     }
 }