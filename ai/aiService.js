/**
 * ai/aiService.js
 * Manages BCAI conversation sessions and AI prompt lifecycle.
 */

import { estimateTokens, logger } from '../utils/utils.js';
import { BCAI, CONFIG } from '../utils/constants.js';
import { getBcaiModelsState, getConversation, saveConversation } from '../storage/storage.js';
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
export async function getActiveConversation(tokenThreshold = CONFIG.TOKEN_THRESHOLD) {
    if (_conversation && _conversation.tokenUsage < tokenThreshold) {
        return _conversation;
    }

    const stored = await getConversation();
    if (stored && stored.tokenUsage < tokenThreshold) {
        // Restore the locally saved transcript so requests match BCAI's conversation payload shape.
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
            messages: _conversation.messages,
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
        messages: _conversation.messages,
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
    const modelConfig = await getSelectedModelConfig();
    // Load conversation once, mutate in memory, save once at end
    const conversation = await getActiveConversation(modelConfig.tokenThreshold);

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
        model: modelConfig.modelId,
        skip_db_save: false,
        messages: conversation.messages
    };

    if (modelConfig.responseMaxTokens) {
        payload.response_max_tokens = modelConfig.responseMaxTokens;
    }

    const rawResponse = await sendConversation(payload);
    const response = parseBcaiResponse(rawResponse);

    // Add assistant message and update token usage
    conversation.messages.push({
        role: 'assistant',
        content: [{ type: 'text', text: response }]
    });

    conversation.tokenUsage += estimateTokens(prompt) + estimateTokens(response);

    await saveConversation({
        guid: conversation.guid,
        tokenUsage: conversation.tokenUsage,
        messages: conversation.messages,
        created: conversation.created
    });

    return response;
}

async function getSelectedModelConfig() {
    const { models, selectedModelId, userSelectedModel } = await getBcaiModelsState();
    const userSelected = userSelectedModel
        ? models.find(model => model.model_id === selectedModelId)
        : null;
    const selectedModel = userSelected || getHighestTokenModel(models);

    if (!selectedModel) {
        return {
            modelId: BCAI.MODEL,
            responseMaxTokens: BCAI.DEFAULT_RESPONSE_MAX_TOKENS,
            tokenThreshold: CONFIG.TOKEN_THRESHOLD
        };
    }

    const supportsResponseMaxTokens = selectedModel.supported_parameters?.includes('response_max_tokens');
    const responseMaxTokens = supportsResponseMaxTokens
        ? selectedModel.default_response_max_tokens || selectedModel.response_max_tokens || BCAI.DEFAULT_RESPONSE_MAX_TOKENS
        : null;

    return {
        modelId: selectedModel.model_id,
        responseMaxTokens,
        tokenThreshold: getTokenThreshold(selectedModel)
    };
}

function getTokenThreshold(model) {
    const maxContextTokens = Number(model.max_context_tokens) || null;
    if (!maxContextTokens) return CONFIG.TOKEN_THRESHOLD;
    return maxContextTokens;
}

function getHighestTokenModel(models) {
    return [...(models || [])].sort((a, b) => {
        const bTokens = Number(b.max_context_tokens) || 0;
        const aTokens = Number(a.max_context_tokens) || 0;
        return bTokens - aTokens;
    })[0] || null;
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

    const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
    let content = '';

    for (const line of lines) {
        const dataLine = line.startsWith('data:') ? line.slice(5).trim() : line;
        if (!dataLine || dataLine === '[DONE]') continue;

        try {
            const json = JSON.parse(dataLine);
            const delta =
                json?.choices?.[0]?.delta?.content ||
                json?.choices?.[0]?.messages?.[0]?.delta ||
                json?.choices?.[0]?.message?.content ||
                json?.message?.content ||
                '';
            if (delta) content += delta;
        } catch {
            try {
                const decoded = JSON.parse(atob(dataLine));
                const delta =
                    decoded?.choices?.[0]?.delta?.content ||
                    decoded?.choices?.[0]?.messages?.[0]?.delta ||
                    decoded?.choices?.[0]?.message?.content ||
                    decoded?.message?.content ||
                    '';
                if (delta) content += delta;
            } catch {
                // Non-JSON lines are silently skipped (SSE comments, etc.)
            }
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

    // Strategy 3: First balanced JSON object or array in surrounding prose.
    const candidate = findBalancedJson(text);
    if (candidate) {
        try {
            return JSON.parse(candidate);
        } catch { /* continue */ }
    }

    logger.warn('extractJson: Could not parse JSON from response:', text.slice(0, 100));
    return null;
}

function findBalancedJson(text) {
    for (let start = 0; start < text.length; start++) {
        const opening = text[start];
        if (opening !== '{' && opening !== '[') continue;
        const stack = [];
        let inString = false;
        let escaped = false;
        for (let index = start; index < text.length; index++) {
            const char = text[index];
            if (inString) {
                if (escaped) escaped = false;
                else if (char === '\\') escaped = true;
                else if (char === '"') inString = false;
                continue;
            }
            if (char === '"') {
                inString = true;
                continue;
            }
            if (char === '{' || char === '[') stack.push(char);
            else if (char === '}' || char === ']') {
                const expected = char === '}' ? '{' : '[';
                if (stack.pop() !== expected) break;
                if (!stack.length) return text.slice(start, index + 1);
            }
        }
    }
    return null;
}
