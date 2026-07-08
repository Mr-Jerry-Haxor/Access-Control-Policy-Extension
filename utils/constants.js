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
    ACP_QUESTIONS: 'https://cairois.web.boeing.com/api/survey/template/{id}/questions',
    ACP_ASSET_SUMMARY: 'https://cairois.web.boeing.com/api/assessmentAssetSummaryVw?where=assetId:%3D:{assetId},assetTypeId:%3D:{assetTypeId},assessmentTypeId:%3D:{assessmentTypeId}',
    ACP_REVIEW_SUMMARIES: 'https://cairois.web.boeing.com/api/asset/{assetTypeId}/{assetId}/assessment/review/summaries?assessmentTypeId={assessmentTypeId}&reviewTypeId=10',
    ACP_CONTACTS: 'https://cairois.web.boeing.com/api/assessment/{id}/contacts',
    ACP_ASSESSMENT_CONTACTS: 'https://cairois.web.boeing.com/api/assessmentContact?where=assessmentId:%3D:{id}',
    ACP_ASSETS: 'https://cairois.web.boeing.com/api/assessment/{id}/assets?extra={extra}',
    ACP_WORKFLOW_STEPS: 'https://cairois.web.boeing.com/api/assessment/{id}/workflowSteps',
    ACP_RECORD: 'https://cairois.web.boeing.com/api/assessment?where=assessmentId:%3D:{id}',
    ACP_SURVEY_TEMPLATE: 'https://cairois.web.boeing.com/api/surveyTemplate/{id}',
    ACP_QUESTION_GROUPS: 'https://cairois.web.boeing.com/api/surveyTemplateQuestionGroup?where=surveyTemplateId:%3D:{id}',
    ACP_SURVEY_QUESTION: 'https://cairois.web.boeing.com/api/assessment/survey/{assessmentId}/question/{questionId}',
    ESATS_ROLES: 'https://cairois.web.boeing.com/api/esatsBusappPersonRole01?where=esatsIdentifier:%3D:{assetId},cairoDeactivatedOn:is null ',
    ESATS_BUSAPP: 'https://cairois.web.boeing.com/api/esatsBusapp?where=baEsatsIdentifier:in:{assetId}&cairoDeactivatedOn:is null ',
    IDENTITY: 'https://cairois.web.boeing.com/api/identity?where=identityId:in:{ids}',
    CED_PUBLIC: 'https://cairois.web.boeing.com/api/cedPublic?where=bemsid:%3D:{bemsId}',
    ASSET_LABEL_SEARCH: 'https://cairois.web.boeing.com/api/asset/label/search'
};

export const BCAI = {
    ENDPOINT: 'https://boeingai.web.boeing.com/genai-backend-api/conversation',
    ORIGIN: 'https://boeingai.web.boeing.com',
    MODEL: 'gpt-5.4-mini',
    CONVERSATION_MODE: ['Information Technology Command Media'],
    CONVERSATION_SOURCE: 'BCAI'
};
