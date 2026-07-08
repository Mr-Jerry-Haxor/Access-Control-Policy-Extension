/**
 * api/requestManager.js
 * HTTP fetch utility with TTL-based caching and retry logic.
 */

import { logger, sleep } from '../utils/utils.js';
import { CONFIG } from '../utils/constants.js';

// ============================================================
// TTL Cache
// ============================================================

/** @type {Map<string, { data: any, timestamp: number }>} */
const memoryCache = new Map();

function isCacheValid(entry) {
    return entry && (Date.now() - entry.timestamp) < CONFIG.CACHE_TTL_MS;
}

export function clearCache() {
    memoryCache.clear();
}

export function removeCacheEntry(url) {
    memoryCache.delete(url);
}

// ============================================================
// Fetch JSON
// ============================================================

const DEFAULTS = {
    retries: 3,
    retryDelay: 1000,
    useCache: true
};

/**
 * Fetches a URL and returns parsed JSON.
 * Handles retries with delay and optional TTL caching.
 * @param {string} url
 * @param {object} options
 */
export async function fetchJson(url, options = {}) {
    const config = { ...DEFAULTS, ...options };

    // Check TTL cache
    if (config.useCache) {
        const cached = memoryCache.get(url);
        if (isCacheValid(cached)) {
            logger.debug('Cache hit:', url);
            return cached.data;
        }
    }

    let lastError;

    for (let attempt = 1; attempt <= config.retries; attempt++) {
        try {
            const response = await fetch(url, {
                credentials: 'include',
                headers: { Accept: 'application/json, text/plain, */*' },
                cache: 'no-store'
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status} ${response.statusText}${body ? ': ' + body.slice(0, 100) : ''}`);
            }

            const data = await response.json();

            if (config.useCache) {
                memoryCache.set(url, { data, timestamp: Date.now() });
            }

            return data;

        } catch (err) {
            lastError = err;
            logger.warn(`Request failed (attempt ${attempt}/${config.retries}):`, url, err.message);
            if (attempt < config.retries) {
                await sleep(config.retryDelay * attempt); // linear backoff
            }
        }
    }

    logger.error('All retry attempts exhausted for:', url);
    throw lastError;
}

/**
 * Posts JSON and returns parsed JSON.
 * @param {string} url
 * @param {object} body
 * @param {object} options
 */
export async function postJson(url, body, options = {}) {
    const config = { retries: 2, retryDelay: 1000, ...options };
    let lastError;

    for (let attempt = 1; attempt <= config.retries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    Accept: 'application/json, text/plain, */*',
                    'Content-Type': 'application/json'
                },
                cache: 'no-store',
                body: JSON.stringify(body || {})
            });

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status} ${response.statusText}${text ? ': ' + text.slice(0, 100) : ''}`);
            }

            return await response.json();
        } catch (err) {
            lastError = err;
            logger.warn(`POST failed (attempt ${attempt}/${config.retries}):`, url, err.message);
            if (attempt < config.retries) {
                await sleep(config.retryDelay * attempt);
            }
        }
    }

    throw lastError;
}
