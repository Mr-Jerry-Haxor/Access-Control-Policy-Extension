/**
 * utils/constants.js
 * Central configuration and URL constants for the ACP Validator extension.
 */

export const CONFIG = {
    VERSION: '1.0.0',
    ACP_ASSESSMENT_TYPE: 48,
    MAX_CONCURRENT_VALIDATIONS: 5,
    TOKEN_THRESHOLD: 180000,
    CACHE_TTL_MS: 5 * 60 * 1000 // 5 minutes
};

export const URLS = {
    PRIMARY_ACPS: 'https://cairois.web.boeing.com/api/asset/4/82/assessment/type/48',
    ACP_DETAIL:   'https://cairois.web.boeing.com/api/assessment/{id}/detail',
    ACP_ANSWERS:  'https://cairois.web.boeing.com/api/assessment/survey/{id}/answers',
    ACP_QUESTIONS: 'https://cairois.web.boeing.com/api/survey/template/{id}/questions'
};

export const BCAI = {
    ENDPOINT: 'https://boeingai.web.boeing.com/genai-backend-api/conversation',
    MODEL: 'gpt-5.4-mini',
    CONVERSATION_MODE: ['Information Technology Command Media'],
    CONVERSATION_SOURCE: 'BCAI'
};