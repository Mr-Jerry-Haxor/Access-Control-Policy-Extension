/**
 * utils/utils.js
 * Shared utilities: helpers, logger, retry, async queue, token estimator.
 */

// ============================================================
// URL / String Helpers
// ============================================================

/** Replaces {key} tokens in a URL string with values from an object. */
export function replaceTokens(url, values) {
    return Object.entries(values).reduce(
        (result, [key, value]) => result.replace(`{${key}}`, encodeURIComponent(value)),
        url
    );
}

/** Returns value if it's an array, otherwise returns []. */
export function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

/** Splits an array into chunks of the given size. */
export function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/** Formats a date value to a locale string. */
export function formatDate(value) {
    if (!value) return '';
    return new Date(value).toLocaleString();
}

/** Generates a cryptographically random UUID. */
export function generateId() {
    return crypto.randomUUID();
}

// ============================================================
// Async Helpers
// ============================================================

/** Promise-based delay. */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries an async function with exponential backoff.
 * @param {Function} fn - Async function to retry.
 * @param {object} options
 * @param {number} options.retries - Max attempts (default 3).
 * @param {number} options.delay - Initial delay in ms (default 1000).
 * @param {number} options.backoff - Backoff multiplier (default 2).
 * @param {Function} options.onRetry - Called on each retry with (error, attempt).
 */
export async function withRetry(fn, options = {}) {
    const { retries = 3, delay = 1000, backoff = 2, onRetry } = options;
    let lastError;
    let currentDelay = delay;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < retries) {
                if (onRetry) onRetry(err, attempt);
                await sleep(currentDelay);
                currentDelay *= backoff;
            }
        }
    }
    throw lastError;
}

/**
 * Concurrency-limited async task queue.
 * Ensures at most `concurrency` tasks run at the same time.
 */
export class AsyncQueue {
    #concurrency;
    #active = 0;
    #queue = [];

    constructor(concurrency = 5) {
        this.#concurrency = concurrency;
    }

    get pending() { return this.#queue.length; }
    get active() { return this.#active; }

    enqueue(taskFn) {
        return new Promise((resolve, reject) => {
            this.#queue.push({ taskFn, resolve, reject });
            this.#tick();
        });
    }

    #tick() {
        while (this.#active < this.#concurrency && this.#queue.length > 0) {
            const { taskFn, resolve, reject } = this.#queue.shift();
            this.#active++;
            taskFn()
                .then(resolve, reject)
                .finally(() => {
                    this.#active--;
                    this.#tick();
                });
        }
    }
}

// ============================================================
// Token Estimator
// ============================================================

/** Estimates token count for a text string (approx 4 chars per token). */
export function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

// ============================================================
// Logger
// ============================================================

const PREFIX = '[ACP]';

export const logger = {
    info:  (...args) => console.log(PREFIX, ...args),
    warn:  (...args) => console.warn(PREFIX, ...args),
    error: (...args) => console.error(PREFIX, ...args),
    debug: (...args) => console.debug(PREFIX, ...args)
};

// Named exports for backward compatibility
export const info  = logger.info;
export const warn  = logger.warn;
export const error = logger.error;