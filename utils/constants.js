/**
 * utils/constants.js
 * Central configuration and URL constants for the ACP Validator extension.
 */

export const CONFIG = {
    VERSION: '1.0.0',
    ACP_ASSESSMENT_TYPE: 48,
    MAX_CONCURRENT_VALIDATIONS: 5,
    MAX_CONCURRENT_APPLICATIONS: 3,
    MAX_CONCURRENT_CONTEXTS: 3,
    AI_RETRY_ATTEMPTS: 2,
    AI_RETRY_BASE_DELAY_MS: 750,
    BCAI_REQUEST_TIMEOUT_MS: 180000,
    TOKEN_THRESHOLD: 180000,
    CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
    BCAI_MODELS_CACHE_TTL_MS: 24 * 60 * 60 * 1000 // 1 day
};

export const URLS = {
    PRIMARY_ACPS: 'https://cairois.web.boeing.com/node-api/assets/4/82/assessment/type/48',
    RISK_PROFILER_ASSESSMENTS: 'https://cairois.web.boeing.com/node-api/assets/4/82/assessment/type/35',
    RISK_PROFILER_ANSWERS: 'https://cairois.web.boeing.com/api/assessment/survey/{id}/answers',
    ACP_DETAIL:   'https://cairois.web.boeing.com/api/assessment/{id}/detail',
    ACP_ANSWERS:  'https://cairois.web.boeing.com/api/assessment/survey/{id}/answers',
    ACP_QUESTIONS: 'https://cairois.web.boeing.com/node-api/survey/template/{id}/questions',
    ACP_ASSET_SUMMARY: 'https://cairois.web.boeing.com/api/assessmentAssetSummaryVw?where=assetId:%3D:{assetId},assetTypeId:%3D:{assetTypeId},assessmentTypeId:%3D:{assessmentTypeId}',
    ACP_REVIEW_SUMMARIES: 'https://cairois.web.boeing.com/node-api/assets/{assetTypeId}/{assetId}/assessment/review/summaries?assessmentTypeId={assessmentTypeId}&reviewTypeId=10',
    ACP_CONTACTS: 'https://cairois.web.boeing.com/api/assessment/{id}/contacts',
    ACP_ASSESSMENT_CONTACTS: 'https://cairois.web.boeing.com/api/assessmentContact?where=assessmentId:%3D:{id}',
    ACP_ASSETS: 'https://cairois.web.boeing.com/node-api/assessments/{id}/assets?extra={extra}',
    ACP_WORKFLOW_STEPS: 'https://cairois.web.boeing.com/api/assessment/{id}/workflowSteps',
    ACP_RECORD: 'https://cairois.web.boeing.com/api/assessment?where=assessmentId:%3D:{id}',
    ACP_SURVEY_TEMPLATE: 'https://cairois.web.boeing.com/api/surveyTemplate/{id}',
    ACP_QUESTION_GROUPS: 'https://cairois.web.boeing.com/api/surveyTemplateQuestionGroup?where=surveyTemplateId:%3D:{id}',
    ACP_SURVEY_QUESTION: 'https://cairois.web.boeing.com/node-api/survey/collector/{assessmentId}/question/{questionId}',
    ESATS_ROLES: 'https://cairois.web.boeing.com/api/esatsBusappPersonRole01?where=esatsIdentifier:%3D:{assetId},cairoDeactivatedOn:is null ',
    ESATS_BUSAPP: 'https://cairois.web.boeing.com/api/esatsBusapp?where=baEsatsIdentifier:in:{assetId}&cairoDeactivatedOn:is null ',
    GSEP_DATABASES: 'https://cairois.web.boeing.com/api/gsepDatabase?limit=4000&where=applicationEsatsId:%3D:{assetId}',
    SIS_SERVER_IDS: 'https://cairois.web.boeing.com/api/sisServerBseId?where=applicationId:%3D:{assetId},cairoDeactivatedOn:is null ',
    SIS_SERVERS: 'https://cairois.web.boeing.com/api/sisAllRecords?where=serverId:in:{serverIds}',
    IDENTITY: 'https://cairois.web.boeing.com/api/identity?where=identityId:in:{ids}',
    CED_PUBLIC: 'https://cairois.web.boeing.com/node-api/identity/ced?bemsId={bemsId}',
    ASSET_LABEL_SEARCH: 'https://cairois.web.boeing.com/api/asset/label/search'
};

export const BCAI = {
    ENDPOINT: 'https://boeingai.web.boeing.com/genai-backend-api/responses',
    MODELS_ENDPOINT: 'https://boeingai.web.boeing.com/bcai-security-api/models',
    DATA_SOURCES_ENDPOINT: 'https://boeingai.web.boeing.com/bcai-security-api/rags-with-models',
    DATA_SOURCE_CATALOG_ENDPOINT: 'https://boeingai.web.boeing.com/bcai-security-api/rags',
    AUTHORIZED_ENDPOINT: 'https://boeingai.web.boeing.com/bcai-security-api/authorized',
    SESSION_ENDPOINT: 'https://boeingai.web.boeing.com/api/oauth/checksession',
    TOKEN_COUNT_ENDPOINT: 'https://boeingai.web.boeing.com/bcai-token-counter-api/count-tokens',
    ORIGIN: 'https://boeingai.web.boeing.com',
    MODEL: 'gpt-5.4-mini',
    DEFAULT_RESPONSE_MAX_TOKENS: 32000,
    DATA_SOURCES: Object.freeze(['Information Technology Command Media']),
    CONVERSATION_SOURCE: 'BCAI'
};
