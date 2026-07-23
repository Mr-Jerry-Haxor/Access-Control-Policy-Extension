/**
 * service_worker.js
 * Background service worker for the ACP Validator extension.
 */

 import { validateContext } from './core/validation.js';
 import { reviewContext, fineTuneSuggestion } from './core/review.js';
 import { buildContexts } from './core/context.js';
 import { saveResults, clearResults, saveReviewResult, clearReviewResults, getBcaiModelsState, saveBcaiModels, saveSelectedBcaiModel, getExtensionSurface, saveExtensionSurface } from './storage/storage.js';
 import { getACPList, getBcaiModels } from './api/apiClient.js';
 import { BCAI, CONFIG, URLS } from './utils/constants.js';

 const activeOperations = new Map();

 chrome.runtime.onInstalled.addListener(() => {
     syncExtensionSurface().catch(error => console.error('Unable to initialize extension display:', error));
 });

 chrome.runtime.onStartup.addListener(() => {
     syncExtensionSurface().catch(error => console.error('Unable to restore extension display:', error));
 });

 syncExtensionSurface().catch(error => console.error('Unable to apply extension display:', error));
 
 chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
     // Consolidated handling
     switch (request.action || request.type) {
         
         case "CHECK_PREREQUISITES":
             checkSessions().then(sendResponse);
             return true;
 
         case "START_VALIDATION":
             if (activeOperations.has('validation') || activeOperations.has('review')) {
                 sendResponse({ started: false, error: 'Another automation operation is already running.' });
                 return false;
             }
             runValidationBatch(request.assessments);
             sendResponse({ started: true });
             return false;

         case "START_REVIEW":
             if (activeOperations.has('validation') || activeOperations.has('review')) {
                 sendResponse({ started: false, error: 'Another automation operation is already running.' });
                 return false;
             }
             runReviewBatch(request.assessments);
             sendResponse({ started: true });
             return false;

         case "CANCEL_REVIEW":
             cancelOperation('review').then(sendResponse);
             return true;

         case "FINE_TUNE_REVIEW_SUGGESTION":
             fineTuneSuggestion({ finding: request.finding, instruction: request.instruction })
                 .then(data => sendResponse({ success: true, ...data }))
                 .catch(err => sendResponse({ success: false, error: err.message }));
             return true;

         case "CANCEL_VALIDATION":
             cancelOperation('validation').then(sendResponse);
             return true;
 
         case "CLEAR_RESULTS":
             clearResults().then(sendResponse);
             return true;

         case "CLEAR_REVIEW_RESULTS":
             clearReviewResults().then(sendResponse);
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

         case "SET_EXTENSION_SURFACE":
             setExtensionSurface(request.surface)
                 .then(sendResponse)
                 .catch(err => sendResponse({ success: false, error: err.message }));
             return true;
     }
 });

 async function syncExtensionSurface() {
     const savedSurface = await getExtensionSurface();
     try {
         await applyExtensionSurface(savedSurface);
     } catch (error) {
         await applyExtensionSurface('popup');
         await saveExtensionSurface('popup');
         throw error;
     }
 }

 async function setExtensionSurface(surface) {
     const normalized = surface === 'sidePanel' ? 'sidePanel' : 'popup';
     if (normalized === 'sidePanel' && (!chrome.sidePanel || !chrome.action?.setPopup)) {
         return {
             success: false,
             surface: 'popup',
             error: 'Side pane mode requires a Chromium browser with the Side Panel API.'
         };
     }

     try {
         await applyExtensionSurface(normalized);
         await saveExtensionSurface(normalized);
         return {
             success: true,
             surface: normalized,
             message: normalized === 'sidePanel'
                 ? 'Side pane mode enabled. Close this view and click the toolbar icon to open it.'
                 : 'Popup mode enabled. Close this view and click the toolbar icon to open it.'
         };
     } catch (error) {
         await applyExtensionSurface('popup');
         await saveExtensionSurface('popup');
         throw error;
     }
 }

 async function applyExtensionSurface(surface) {
     if (!chrome.action?.setPopup) {
         throw new Error('The browser action API is unavailable.');
     }

     if (surface === 'sidePanel') {
         if (!chrome.sidePanel) {
             throw new Error('The Side Panel API is unavailable.');
         }
         await chrome.sidePanel.setOptions({
             path: 'popup/sidepanel.html',
             enabled: true
         });
         await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
         await chrome.action.setPopup({ popup: '' });
         return;
     }

     await chrome.action.setPopup({ popup: 'popup/popup.html' });
     if (chrome.sidePanel) {
         await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
         await chrome.sidePanel.setOptions({
             path: 'popup/sidepanel.html',
             enabled: false
         });
     }
 }

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
         { id: 'cairo', url: URLS.PRIMARY_ACPS },
         { id: 'boeingai', url: BCAI.MODELS_ENDPOINT }
     ];
     
     const checks = await Promise.all(sites.map(async (site) => {
         try {
             const res = await fetch(site.url, {
                 method: 'GET',
                 credentials: 'include',
                 headers: { Accept: 'application/json, text/plain, */*' },
                 cache: 'no-store'
             });
             const finalHost = new URL(res.url || site.url).hostname;
             const passed = res.ok && finalHost === new URL(site.url).hostname;
             return { id: site.id, passed, message: passed ? 'Accessible' : `HTTP ${res.status}`, finalUrl: res.url || site.url };
         } catch (err) {
             return { id: site.id, passed: false, message: 'Auth/Connection Error', finalUrl: site.url };
         }
     }));
     return { success: true, prerequisites: { checks } };
 }
 
 async function cancelOperation(mode) {
     const operation = activeOperations.get(mode);
     if (operation) {
         operation.cancelled = true;
         operation.controller.abort();
     }
     const prefix = mode === 'review' ? 'review' : 'validation';
     const state = await chrome.storage.local.get(`${prefix}Progress`);
     await chrome.storage.local.set({
         [`${prefix}Cancelled`]: true,
         [`${prefix}Complete`]: true,
         [`${prefix}Progress`]: {
             ...(state[`${prefix}Progress`] || {}),
             current: `${mode === 'review' ? 'Review' : 'Validation'} cancelled.`
         }
     });
     return { cancelled: true, active: !!operation };
 }

 async function operationCancelled(mode, operation) {
     if (operation.cancelled || operation.controller.signal.aborted) return true;
     const key = mode === 'review' ? 'reviewCancelled' : 'validationCancelled';
     const state = await chrome.storage.local.get(key);
     return !!state[key];
 }

 async function runReviewBatch(assessments) {
     const total = assessments.length;
     let completed = 0;
     const startedAt = Date.now();
     const operation = { controller: new AbortController(), cancelled: false };
     activeOperations.set('review', operation);

     try {
         await clearReviewResults();
         await chrome.storage.local.set({
             reviewProgress: { completed: 0, total, mode: 'review', startedAt, current: 'Gathering ACP review context...' },
             reviewComplete: false,
             reviewError: null,
             reviewCancelled: false
         });
         const contexts = await buildContexts(assessments);
         const isCancelled = () => operationCancelled('review', operation);
         if (await isCancelled()) {
             await chrome.storage.local.set({ reviewComplete: true, reviewCancelled: true });
             return;
         }
         await chrome.storage.local.set({ reviewProgress: { completed: 0, total, mode: 'review', startedAt, current: 'Reviewing selected question answers...' } });
         await runWithConcurrency(contexts, CONFIG.MAX_CONCURRENT_APPLICATIONS, async context => {
             if (await isCancelled()) return;
             const assessmentId = context.assessment?.assessmentId || context.detail?.assessmentId;
             const assessmentTitle = context.assessment?.title || context.detail?.assetName || `Assessment ${assessmentId}`;
             await chrome.storage.local.set({ reviewProgress: { completed, total, mode: 'review', startedAt, current: `Reviewing assessment ${assessmentId}...` } });
             const review = context.buildError
                 ? { mode: 'review', generatedAt: new Date().toISOString(), questionAnalysis: [], newQuestions: [], error: context.buildError }
                 : await reviewContext(context, isCancelled, current => chrome.storage.local.set({
                     reviewProgress: { completed, total, mode: 'review', startedAt, current }
                 }), { signal: operation.controller.signal });
             if (await isCancelled()) return;
             await saveReviewResult(assessmentId, review, assessmentTitle);
             completed++;
             await chrome.storage.local.set({
                 reviewProgress: { completed, total, mode: 'review', startedAt, current: `Reviewed assessment ${assessmentId}` }
             });
         });
         if (!operation.cancelled) await chrome.storage.local.set({ reviewComplete: true });
     } catch (error) {
         if (!operation.cancelled && error?.name !== 'AbortError') {
             await chrome.storage.local.set({ reviewComplete: true, reviewError: error.message });
         }
     } finally {
         if (activeOperations.get('review') === operation) activeOperations.delete('review');
     }
 }

 async function runValidationBatch(assessments) {
     let completed = 0;
     const total = assessments.length;
     const startedAt = Date.now();
     const operation = { controller: new AbortController(), cancelled: false };
     activeOperations.set('validation', operation);

     try {
         await clearResults();
         await chrome.storage.local.set({
             validationProgress: { completed: 0, total, mode: 'validation', startedAt, current: 'Gathering context for all assessments...' },
             validationComplete: false,
             validationError: null,
             validationCancelled: false
         });
         // 1. Gather context for each assessment
         const contexts = await buildContexts(assessments);

         const isCancelled = () => operationCancelled('validation', operation);
         if (await isCancelled()) {
             await chrome.storage.local.set({ validationComplete: true, validationCancelled: true });
             return;
         }
         
         await chrome.storage.local.set({ 
             validationProgress: { completed: 0, total, mode: 'validation', startedAt, current: 'Validating against checkpoints...' }
         });

         // 3. Validate and persist each context so progress advances per assessment.
         await runWithConcurrency(contexts, CONFIG.MAX_CONCURRENT_APPLICATIONS, async context => {
             if (await isCancelled()) return;
             const assessmentId = context.assessment?.assessmentId || context.detail?.assessmentId;
             const assessmentTitle = context.assessment?.title || context.detail?.assetName || `Assessment ${assessmentId}`;
             await chrome.storage.local.set({ validationProgress: { completed, total, mode: 'validation', startedAt, current: `Validating assessment ${assessmentId}...` } });
             const results = context.buildError
                 ? [{ checkpointId: 'SETUP', checkpointName: 'Context Gathering', category: 'System', status: 'ERROR', message: `Failed to load assessment data: ${context.buildError}`, source: 'SYSTEM' }]
                 : await validateContext(context, isCancelled, current => chrome.storage.local.set({
                     validationProgress: { completed, total, mode: 'validation', startedAt, current }
                 }), { signal: operation.controller.signal });
             if (await isCancelled()) return;
             await saveResults(assessmentId, results, assessmentTitle);
             completed++;
             await chrome.storage.local.set({ 
                 validationProgress: { 
                     completed,
                     total,
                     mode: 'validation',
                     startedAt,
                     current: `Validated assessment ${assessmentId}`
                 } 
             });
         });

         if (!operation.cancelled) await chrome.storage.local.set({ validationComplete: true });
     } catch (err) {
         if (!operation.cancelled && err?.name !== 'AbortError') {
             await chrome.storage.local.set({
                 validationComplete: true,
                 validationError: err.message
             });
         }
     } finally {
         if (activeOperations.get('validation') === operation) activeOperations.delete('validation');
     }
 }

 async function runWithConcurrency(items, limit, worker) {
     let nextIndex = 0;
     const runWorker = async () => {
         while (nextIndex < items.length) {
             const item = items[nextIndex++];
             await worker(item);
         }
     };
     await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
 }
