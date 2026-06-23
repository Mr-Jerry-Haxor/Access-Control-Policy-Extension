/**
 * service_worker.js
 * Background service worker for the ACP Validator extension.
 * Handles installation events and cross-context messaging.
 */

import { CONFIG } from './utils/constants.js';

// ============================================================
// Lifecycle
// ============================================================

chrome.runtime.onInstalled.addListener(({ reason }) => {
    console.log(`[ACP] v${CONFIG.VERSION} installed. Reason: ${reason}`);
});

// ============================================================
// Message Handling
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
        .then(sendResponse)
        .catch(err => {
            console.error('[ACP] Message handler error:', err);
            sendResponse({ success: false, error: err.message });
        });

    // Return true to indicate async sendResponse
    return true;
});

async function handleMessage(message, sender) {
    switch (message.type) {

        case 'PING':
            return { success: true, version: CONFIG.VERSION };

        case 'CLEAR_CACHE': {
            const { clearCache } = await import('./api/requestManager.js');
            clearCache();
            return { success: true };
        }

        case 'RESET_CONVERSATION': {
            const { resetConversation } = await import('./ai/aiService.js');
            await resetConversation();
            return { success: true };
        }

        default:
            return { success: false, error: `Unknown message type: ${message.type}` };
    }
}