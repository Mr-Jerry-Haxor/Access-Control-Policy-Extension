/**
 * service_worker.js
 * Background service worker for the ACP Validator extension.
 */

 import { validateContexts } from './core/validation.js';
 import { buildContexts } from './core/context.js';
 import { saveResults, clearResults, getBcaiModelsState, saveBcaiModels, saveSelectedBcaiModel } from './storage/storage.js';
 import { getACPList, getBcaiModels } from './api/apiClient.js';
 import { CONFIG } from './utils/constants.js';
 import { resetConversation } from './ai/aiService.js';
 
 chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
     // Consolidated handling
     switch (request.action || request.type) {
         
         case "CHECK_PREREQUISITES":
             checkSessions().then(sendResponse);
             return true;
 
         case "START_VALIDATION":
             // Clear any previous cancel signal and start fresh
             chrome.storage.local.remove('validationCancelled');
             runValidationBatch(request.assessments);
             sendResponse({ started: true });
             return false;

         case "CANCEL_VALIDATION":
             chrome.storage.local.set({ validationCancelled: true });
             sendResponse({ cancelled: true });
             return false;
 
         case "CLEAR_RESULTS":
             clearResults().then(sendResponse);
             return true;
 
         case "LOAD_ACPS":
             getACPList()
                 .then(data => sendResponse({ success: true, data }))
                 .catch(err => sendResponse({ success: false, error: err.message }));
             return true;

         case "LOAD_BCAI_MODELS":
             loadBcaiModels({ force: !!request.force })
                 .then(data => sendResponse({ success: true, ...data }))
                 .catch(err => sendResponse({ success: false, error: err.message }));
             return true;

         case "SAVE_BCAI_MODEL":
             saveSelectedBcaiModel(request.modelId, true)
                 .then(() => sendResponse({ success: true }))
                 .catch(err => sendResponse({ success: false, error: err.message }));
             return true;
     }
 });

 async function loadBcaiModels({ force = false } = {}) {
     const state = await getBcaiModelsState();
     const cacheAge = Date.now() - (state.fetchedAt || 0);
     const cacheFresh = state.models.length > 0 && cacheAge < CONFIG.BCAI_MODELS_CACHE_TTL_MS;

     if (!force && cacheFresh) {
         const selection = resolveModelSelection(state.models, state);
         if (selection.selectedModelId !== state.selectedModelId || selection.userSelectedModel !== state.userSelectedModel) {
             await saveSelectedBcaiModel(selection.selectedModelId, selection.userSelectedModel);
         }
         return { ...state, ...selection, fromCache: true };
     }

     const models = await getBcaiModels();
     if (!models.length) {
         if (state.models.length) {
             const selection = resolveModelSelection(state.models, state);
             return { ...state, ...selection, fromCache: true, stale: true };
         }
         throw new Error('No BCAI models returned.');
     }

     const selection = resolveModelSelection(models, state);

     const fetchedAt = Date.now();
     await saveBcaiModels(models, fetchedAt);
     await saveSelectedBcaiModel(selection.selectedModelId, selection.userSelectedModel);

     return { models, fetchedAt, ...selection, fromCache: false };
 }

 function resolveModelSelection(models, state) {
     const selectedStillExists = state.userSelectedModel
         && models.some(model => model.model_id === state.selectedModelId);
     const selectedModelId = selectedStillExists
         ? state.selectedModelId
         : getHighestTokenModel(models).model_id;

     return {
         selectedModelId,
         userSelectedModel: selectedStillExists
     };
 }

 function getHighestTokenModel(models) {
     return [...models].sort((a, b) => {
         const bTokens = Number(b.max_context_tokens) || 0;
         const aTokens = Number(a.max_context_tokens) || 0;
         return bTokens - aTokens;
     })[0];
 }
 
 async function checkSessions() {
     const sites = [
         { id: 'cairo', url: 'https://cairois.web.boeing.com/' },
         { id: 'boeingai', url: 'https://boeingai.web.boeing.com/' }
     ];
     
     const checks = await Promise.all(sites.map(async (site) => {
         try {
             const res = await fetch(site.url, { method: 'HEAD', credentials: 'include' });
             return { id: site.id, passed: res.ok, message: res.statusText, finalUrl: site.url };
         } catch (err) {
             return { id: site.id, passed: false, message: 'Auth/Connection Error', finalUrl: site.url };
         }
     }));
     return { success: true, prerequisites: { checks } };
 }
 
 async function isCancelled() {
     const { validationCancelled } = await chrome.storage.local.get('validationCancelled');
     return !!validationCancelled;
 }

 async function runValidationBatch(assessments) {
     let completed = 0;
     const total = assessments.length;
 
     // Clear old validation results before starting a new run
     await clearResults();

     // Reset progress and cancel flags
     await chrome.storage.local.set({ 
         validationProgress: { completed: 0, total, current: 'Gathering context for all assessments...' },
         validationComplete: false,
         validationError: null,
         validationCancelled: false
     });
 
     try {
         // 1. Gather context for each assessment
         const contexts = await buildContexts(assessments);

         if (await isCancelled()) {
             await chrome.storage.local.set({ validationComplete: true, validationCancelled: true });
             return;
         }
         
         // 2. Reset conversation
         await resetConversation();
         
         await chrome.storage.local.set({ 
             validationProgress: { completed: 0, total, current: 'Validating against checkpoints...' } 
         });

         // 3. Validate each context, respecting cancel signal
         const results = await validateContexts(contexts, isCancelled);
         
         for (const res of results) {
             if (await isCancelled()) break;
             await saveResults(res.assessmentId, res.results, res.assessmentTitle);
             completed++;
             await chrome.storage.local.set({ 
                 validationProgress: { 
                     completed, 
                     total, 
                     current: `Processed assessment ${res.assessmentId}` 
                 } 
             });
         }
         
         await chrome.storage.local.set({ validationComplete: true });
     } catch (err) {
         await chrome.storage.local.set({ 
             validationComplete: true,
             validationError: err.message 
         });
     }
 }
