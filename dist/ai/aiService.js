/**
 * ai/aiService.js
 * Manages BCAI conversation sessions and AI prompt lifecycle.
 */

import { estimateTokens, logger, sleep } from '../utils/utils.js';
import { BCAI, CONFIG } from '../utils/constants.js';
import { getBcaiModelsState, getConversation, saveConversation } from '../storage/storage.js';
import { countBcaiTokens, sendConversation } from '../api/apiClient.js';

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

/** Creates an isolated in-memory BCAI chat for one application or auditor. */
export function createConversationSession(label = 'application') {
    return {
        ...createConversation(),
        label,
        isolated: true
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
export async function sendPrompt(prompt, options = {}) {
    const {
        session = null,
        signal = null,
        retries = CONFIG.AI_RETRY_ATTEMPTS
    } = options;
    const modelConfig = await getSelectedModelConfig();
    const conversation = session || await getActiveConversation(modelConfig.tokenThreshold);
    const userMessage = {
        role: 'user',
        content: [{ type: 'text', text: prompt }]
    };

    const payload = buildBcaiResponsesPayload(
        conversation,
        modelConfig.modelId,
        [...conversation.messages, userMessage]
    );

    try {
        const requestTokens = await countBcaiTokens(payload.input, payload.model, { signal });
        if (requestTokens >= modelConfig.tokenThreshold) {
            const error = new Error(`BCAI input is too large for ${payload.model} (${requestTokens} tokens; safe limit ${modelConfig.tokenThreshold}).`);
            error.name = 'BcaiInputTooLargeError';
            error.retryable = false;
            throw error;
        }
    } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw abortError();
        if (error?.name === 'BcaiInputTooLargeError') throw error;
        logger.warn('BCAI token counting was unavailable; continuing with the local estimate:', error.message);
    }

    let response = '';
    let responseUsage = null;
    let lastError = null;
    for (let attempt = 1; attempt <= Math.max(1, retries); attempt++) {
        if (signal?.aborted) throw abortError();
        try {
            const rawResponse = await sendConversation(payload, { signal });
            const parsedResponse = parseBcaiResponseDetails(rawResponse);
            if (parsedResponse.error) throw bcaiResponseError(parsedResponse.error, true);
            if (parsedResponse.status === 'incomplete') {
                throw bcaiResponseError(
                    parsedResponse.incompleteDetails?.reason || 'BCAI returned an incomplete response.',
                    false
                );
            }
            response = parsedResponse.text;
            if (!response.trim()) throw new Error('BCAI returned an empty response.');
            conversation.lastOutputItem = parsedResponse.outputItem;
            responseUsage = parsedResponse.usage;
            lastError = null;
            break;
        } catch (error) {
            if (signal?.aborted || error?.name === 'AbortError') throw abortError();
            lastError = error;
            logger.warn(`BCAI prompt attempt ${attempt}/${retries} failed:`, error.message);
            if (error?.retryable === false) break;
            if (attempt < retries) {
                await sleep(CONFIG.AI_RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)));
            }
        }
    }
    if (lastError) throw lastError;

    // Add assistant message and update token usage
    conversation.messages.push(
        userMessage,
        conversation.lastOutputItem || {
            role: 'assistant',
            content: [{ type: 'text', text: response }]
        }
    );
    delete conversation.lastOutputItem;

    const actualTotalTokens = Number(responseUsage?.total_tokens);
    conversation.tokenUsage = Number.isFinite(actualTotalTokens)
        ? actualTotalTokens
        : conversation.tokenUsage + estimateTokens(prompt) + estimateTokens(response);

    if (!conversation.isolated) {
        await saveConversation({
            guid: conversation.guid,
            tokenUsage: conversation.tokenUsage,
            messages: conversation.messages,
            created: conversation.created
        });
    }

    return response;
}

function abortError() {
    return new DOMException('Operation cancelled.', 'AbortError');
}

function bcaiResponseError(detail, retryable) {
    const message = typeof detail === 'string'
        ? detail
        : detail?.message || detail?.code || JSON.stringify(detail);
    const error = new Error(`BCAI response failed: ${message}`);
    error.name = 'BcaiResponseError';
    error.retryable = retryable;
    return error;
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
            tokenThreshold: CONFIG.TOKEN_THRESHOLD,
            maxContextTokens: CONFIG.TOKEN_THRESHOLD
        };
    }

    return {
        modelId: selectedModel.model_id,
        tokenThreshold: getTokenThreshold(selectedModel),
        maxContextTokens: Number(selectedModel.max_context_tokens) || null
    };
}

/**
 * Builds the request shape used by the current BCAI Responses endpoint.
 * Keep model capability metadata out of this payload: the October 2026 BCAI
 * HAR shows that gpt-6-luna succeeds without reasoning_effort or token fields.
 */
export function buildBcaiResponsesPayload(conversation, modelId, messages) {
    return {
        bcai_options: {
            data_sources: [...BCAI.DATA_SOURCES],
            request_source: BCAI.CONVERSATION_SOURCE,
            database_options: {
                save_to_database: false,
                conversation_name: '',
                guid: conversation.guid
            }
        },
        model: modelId,
        input: messages.map(toResponsesMessage),
        stream: true
    };
}

function toResponsesMessage(message) {
    const role = message?.role === 'assistant' ? 'assistant' : 'user';
    const content = Array.isArray(message?.content) ? message.content : [message?.content];
    const type = role === 'assistant' ? 'output_text' : 'input_text';

    const normalized = {
        role,
        type: 'message',
        content: content.map(part => ({
            type,
            text: typeof part === 'string'
                ? (part || '[empty]')
                : (part?.text || '[empty]'),
            ...(type === 'output_text' ? {
                annotations: Array.isArray(part?.annotations) ? part.annotations : [],
                logprobs: Array.isArray(part?.logprobs) ? part.logprobs : []
            } : {})
        }))
    };

    if (role === 'assistant' && message?.id) normalized.id = message.id;
    if (role === 'assistant' && message?.status) normalized.status = message.status;
    if (role === 'assistant' && message?.phase) normalized.phase = message.phase;
    return normalized;
}

function getTokenThreshold(model) {
    const maxContextTokens = Number(model.max_context_tokens) || null;
    if (!maxContextTokens) return CONFIG.TOKEN_THRESHOLD;
    return Math.floor(maxContextTokens * 0.9);
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
    return parseBcaiResponseDetails(raw).text;
}

/** Returns response text plus the completed assistant item used as history. */
export function parseBcaiResponseDetails(raw) {
    if (!raw) return { text: '', outputItem: null };

    const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
    let content = '';
    let outputItem = null;
    let status = null;
    let usage = null;
    let error = null;
    let incompleteDetails = null;
    let responseId = null;
    let model = null;

    for (const line of lines) {
        const dataLine = line.startsWith('data:') ? line.slice(5).trim() : line;
        if (!dataLine || dataLine === '[DONE]') continue;

        try {
            const json = JSON.parse(dataLine);
            const metadata = getResponseMetadata(json);
            status = metadata.status || status;
            usage = metadata.usage || usage;
            error = metadata.error || error;
            incompleteDetails = metadata.incompleteDetails || incompleteDetails;
            responseId = metadata.responseId || responseId;
            model = metadata.model || model;
            outputItem = getCompletedOutputItem(json) || outputItem;
            const delta =
                (json?.type === 'response.output_text.delta' ? json.delta : '') ||
                json?.choices?.[0]?.delta?.content ||
                json?.choices?.[0]?.messages?.[0]?.delta ||
                json?.choices?.[0]?.message?.content ||
                json?.message?.content ||
                (!content ? extractCompletedResponseText(json) : '') ||
                '';
            if (delta) content += delta;
        } catch {
            try {
                const decoded = JSON.parse(atob(dataLine));
                const metadata = getResponseMetadata(decoded);
                status = metadata.status || status;
                usage = metadata.usage || usage;
                error = metadata.error || error;
                incompleteDetails = metadata.incompleteDetails || incompleteDetails;
                responseId = metadata.responseId || responseId;
                model = metadata.model || model;
                outputItem = getCompletedOutputItem(decoded) || outputItem;
                const delta =
                    (decoded?.type === 'response.output_text.delta' ? decoded.delta : '') ||
                    decoded?.choices?.[0]?.delta?.content ||
                    decoded?.choices?.[0]?.messages?.[0]?.delta ||
                    decoded?.choices?.[0]?.message?.content ||
                    decoded?.message?.content ||
                    (!content ? extractCompletedResponseText(decoded) : '') ||
                    '';
                if (delta) content += delta;
            } catch {
                // Non-JSON lines are silently skipped (SSE comments, etc.)
            }
        }
    }

    return { text: content, outputItem, status, usage, error, incompleteDetails, responseId, model };
}

function getResponseMetadata(event) {
    const response = event?.response || null;
    const eventError = event?.type === 'error' ? event.error || event : null;
    return {
        status: response?.status || (event?.type === 'response.incomplete' ? 'incomplete' : null),
        usage: response?.usage || null,
        error: response?.error || eventError,
        incompleteDetails: response?.incomplete_details || null,
        responseId: response?.id || null,
        model: response?.model || null
    };
}

function getCompletedOutputItem(event) {
    if (event?.type === 'response.output_item.done' && event?.item?.type === 'message') {
        return event.item;
    }
    const output = event?.response?.output;
    if (!Array.isArray(output)) return null;
    return output.find(item => item?.type === 'message' && item?.role === 'assistant') || null;
}

function extractCompletedResponseText(event) {
    const response = event?.response || event;
    if (typeof response?.output_text === 'string') return response.output_text;

    for (const item of response?.output || []) {
        for (const part of item?.content || []) {
            if (part?.type === 'output_text' && typeof part.text === 'string') {
                return part.text;
            }
        }
    }
    return '';
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
