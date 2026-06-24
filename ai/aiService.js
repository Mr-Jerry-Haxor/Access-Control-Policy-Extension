/**
 * ai/aiService.js
 * Manages BCAI conversation sessions and AI prompt lifecycle.
 */

import { estimateTokens, logger } from '../utils/utils.js';
import { BCAI, CONFIG } from '../utils/constants.js';
import { getConversation, saveConversation } from '../storage/storage.js';
import { sendConversation } from '../api/apiClient.js';

// ============================================================
// Conversation Management
// ============================================================

let _conversation = null;

function createConversation() {
    return {
        guid: Date.now() + '-' + crypto.randomUUID(),
        tokenUsage: 0,
        messages: [],
        created: Date.now()
    };
}

/** Gets the active conversation, creating a new one if needed or over token limit. */
export async function getActiveConversation() {
    if (_conversation && _conversation.tokenUsage < CONFIG.TOKEN_THRESHOLD) {
        return _conversation;
    }

    const stored = await getConversation();
    if (stored && stored.tokenUsage < CONFIG.TOKEN_THRESHOLD) {
        // Restore from storage, but messages are in-memory (fresh/empty or reconstructed, BCAI tracks history server-side using guid)
        _conversation = {
            guid: stored.guid,
            tokenUsage: stored.tokenUsage,
            messages: stored.messages || [],
            created: stored.created || Date.now()
        };
    } else {
        if (stored) {
            logger.info(`Token limit reached (${stored.tokenUsage}). Starting new conversation.`);
        }
        _conversation = createConversation();
        await saveConversation({
            guid: _conversation.guid,
            tokenUsage: _conversation.tokenUsage,
            created: _conversation.created
        });
    }

    return _conversation;
}

/** Resets the conversation to a clean state. */
export async function resetConversation() {
    _conversation = createConversation();
    await saveConversation({
        guid: _conversation.guid,
        tokenUsage: _conversation.tokenUsage,
        created: _conversation.created
    });
    logger.info('Conversation reset.');
    return _conversation;
}

// ============================================================
// Prompt Sending
// ============================================================

/**
 * Sends a prompt to the BCAI AI and returns the text response.
 * Manages conversation state in a single in-memory pass to avoid
 * redundant storage reads.
 * @param {string} prompt
 * @returns {string} Parsed AI response text
 */
export async function sendPrompt(prompt) {
    // Load conversation once, mutate in memory, save once at end
    const conversation = await getActiveConversation();

    // Add user message
    conversation.messages.push({
        role: 'user',
        content: [{ type: 'text', text: prompt }]
    });

    const payload = {
        conversation_guid: conversation.guid,
        conversation_mode: BCAI.CONVERSATION_MODE,
        conversation_source: BCAI.CONVERSATION_SOURCE,
        conversation_name: '',
        model: BCAI.MODEL,
        skip_db_save: false,
        messages: conversation.messages
    };

    const rawResponse = await sendConversation(payload);
    const response = parseBcaiResponse(rawResponse);

    // Add assistant message and update token usage
    conversation.messages.push({
        role: 'assistant',
        content: [{ type: 'text', text: response }]
    });

    conversation.tokenUsage += estimateTokens(prompt) + estimateTokens(response);

    // Save only lightweight metadata to chrome.storage.local
    await saveConversation({
        guid: conversation.guid,
        tokenUsage: conversation.tokenUsage,
        created: conversation.created
    });

    return response;
}

// ============================================================
// Response Parsing
// ============================================================

/**
 * Parses the BCAI streaming response format.
 * Joins all delta chunks from SSE-style JSON lines.
 * @param {string} raw
 * @returns {string}
 */
export function parseBcaiResponse(raw) {
    if (!raw) return '';

    const lines = raw.split('\n').filter(Boolean);
    let content = '';

    for (const line of lines) {
        try {
            const json = JSON.parse(line);
            const delta = json?.choices?.[0]?.messages?.[0]?.delta;
            if (delta) content += delta;
        } catch {
            // Non-JSON lines are silently skipped (SSE comments, etc.)
        }
    }

    return content;
}

/**
 * Attempts to extract a JSON object/array from a text response.
 * Tries multiple strategies: direct parse, markdown code fence, raw braces.
 * @param {string} text
 * @returns {object|null}
 */
export function extractJson(text) {
    if (!text) return null;

    // Strategy 1: Direct parse
    try {
        return JSON.parse(text.trim());
    } catch { /* continue */ }

    // Strategy 2: Markdown code fence (```json ... ```)
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
        try {
            return JSON.parse(fenceMatch[1].trim());
        } catch { /* continue */ }
    }

    // Strategy 3: First JSON object or array in text
    const objMatch = text.match(/(\{[\s\S]*?\}|\[[\s\S]*?\])/);
    if (objMatch) {
        try {
            return JSON.parse(objMatch[1]);
        } catch { /* continue */ }
    }

    logger.warn('extractJson: Could not parse JSON from response:', text.slice(0, 100));
    return null;
}