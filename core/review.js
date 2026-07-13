/** Modular ACP review workflow built on the checkpoint registry and normalized context. */
import { getAllCheckpoints } from './checkpoint.js';
import { sendPrompt, extractJson } from '../ai/aiService.js';
import { REVIEW_PROMPTS } from '../utils/constants.js';
import { ACP_REVIEW_GUIDANCE } from '../knowledge/acpReviewGuidance.js';
import { CHECKPOINT_EVIDENCE } from '../knowledge/checkpointEvidenceMap.js';

const STATES = new Set(['CORRECT', 'PARTIAL', 'INCORRECT', 'MISSING', 'NOT_APPLICABLE', 'NEEDS_VERIFICATION']);

export async function reviewContexts(contexts, isCancelled) {
    const output = [];
    for (const context of contexts) {
        if (isCancelled && await isCancelled()) break;
        const assessmentId = context.assessment?.assessmentId || context.detail?.assessmentId;
        const assessmentTitle = context.assessment?.title || context.detail?.assetName || `Assessment ${assessmentId}`;
        if (context.buildError) {
            output.push({ assessmentId, assessmentTitle, review: errorReview(context.buildError) });
            continue;
        }
        output.push({ assessmentId, assessmentTitle, review: await reviewContext(context, isCancelled) });
    }
    return output;
}

export async function reviewContext(context, isCancelled, onProgress) {
    const checkpointAnalysis = [];
    for (const checkpoint of getAllCheckpoints()) {
        if (isCancelled && await isCancelled()) break;
        await onProgress?.(`Analyzing checkpoint ${checkpoint.id}: ${checkpoint.name}`);
        checkpointAnalysis.push(await reviewCheckpoint(checkpoint, context));
    }

    const questionAnalysis = [];
    const reviewableQuestions = (context.normalizedQuestions || []).filter(question => question.answered);
    const groups = groupQuestions(reviewableQuestions);
    for (const [group, questions] of groups) {
        if (isCancelled && await isCancelled()) break;
        await onProgress?.(`Analyzing ${questions.length} question${questions.length === 1 ? '' : 's'} in ${group}`);
        questionAnalysis.push(...await reviewQuestionGroup(questions, context));
    }

    return {
        mode: 'review',
        generatedAt: new Date().toISOString(),
        checkpointAnalysis,
        questionAnalysis,
        // Extension point for future question-generation logic.
        newQuestions: [],
        summary: summarizeReview(checkpointAnalysis, questionAnalysis)
    };
}

function summarizeReview(checkpoints, questions) {
    const countStates = findings => findings.reduce((counts, finding) => {
        counts[finding.state] = (counts[finding.state] || 0) + 1;
        return counts;
    }, {});
    return {
        checkpointCount: checkpoints.length,
        questionCount: questions.length,
        checkpointStates: countStates(checkpoints),
        questionStates: countStates(questions),
        answeredQuestions: questions.filter(question => question.answered).length,
        questionsWithSuggestions: questions.filter(question => question.suggestedText).length
    };
}

async function reviewCheckpoint(checkpoint, context) {
    const promptTemplate = checkpoint.reviewPrompt;
    if (!promptTemplate) return normalizeFinding({}, { id: checkpoint.id, name: checkpoint.name }, 'No review prompt is configured for this checkpoint.');
    let checkpointCriterion = null;
    let deterministicResult = null;
    try {
        if (typeof checkpoint.buildPrompt === 'function') checkpointCriterion = checkpoint.buildPrompt(context);
        if (checkpoint.type !== 'AI' && typeof checkpoint.validate === 'function') deterministicResult = await checkpoint.validate(context);
    } catch (error) {
        deterministicResult = { status: 'ERROR', message: error.message };
    }
    const evidence = {
        assessment: context.assessment,
        checkpointCriterion,
        deterministicResult,
        questions: (CHECKPOINT_EVIDENCE[checkpoint.id] || [])
            .map(id => context.normalizedQuestionMap?.get(String(id)))
            .filter(Boolean),
        externalEvidence: {
            reviewSummaries: checkpoint.id === 'ACP1' ? context.supportingData?.reviewSummaries : undefined,
            esatsBusapp: ['ACP2', 'ACP7'].includes(checkpoint.id) ? context.supportingData?.esatsBusapp : undefined,
            esatsRoles: checkpoint.id === 'ACP7' ? context.supportingData?.esatsRoles : undefined,
            assetLabels: ['ACP9', 'ACP14', 'ACP15', 'ACP18', 'ACP20', 'ACP21'].includes(checkpoint.id) ? context.supportingData?.assetLabels : undefined,
            identities: checkpoint.id === 'ACP17' ? context.supportingData?.identities : undefined,
            cedPublic: ['ACP17', 'ACP27'].includes(checkpoint.id) ? context.supportingData?.cedPublic : undefined
        }
    };
    const finding = await requestFinding(`${promptTemplate}\n\nACP GUIDANCE:\n${ACP_REVIEW_GUIDANCE}\n\nCHECKPOINT: ${checkpoint.id} - ${checkpoint.name}\nCONTEXT:\n${JSON.stringify(evidence)}`, { id: checkpoint.id, name: checkpoint.name });
    if (deterministicResult?.status === 'FAIL') {
        finding.state = 'INCORRECT';
        finding.whatIsWrong = [...new Set([deterministicResult.message, ...finding.whatIsWrong].filter(Boolean))];
    } else if (['ERROR', 'REVIEW'].includes(deterministicResult?.status)) {
        finding.state = 'NEEDS_VERIFICATION';
        finding.requiresHumanVerification = true;
        finding.whatIsWrong = [...new Set([deterministicResult.message, ...finding.whatIsWrong].filter(Boolean))];
    }
    return finding;
}

async function reviewQuestionGroup(questions, context) {
    const crossSection = {
        assessment: context.assessment,
        roleQuestion: context.normalizedQuestionMap?.get('ACP-AR1') || null,
        riskProfilerLabels: context.supportingData?.assetLabels || [],
        esatsDescription: context.supportingData?.esatsBusapp || null
    };
    try {
        const prompt = `${REVIEW_PROMPTS.QUESTION_WISE_BATCH}\n\nACP GUIDANCE:\n${ACP_REVIEW_GUIDANCE}\n\nCROSS-SECTION EVIDENCE:\n${JSON.stringify(crossSection)}\n\nQUESTIONS:\n${JSON.stringify(questions)}`;
        const parsed = extractJson(await sendPrompt(prompt));
        const results = Array.isArray(parsed) ? parsed : parsed?.questionAnalysis || parsed?.questions || [];
        return questions.map((question, index) => normalizeFinding(
            results.find(result => String(result.id) === String(question.id)) || results[index] || {},
            questionIdentity(question),
            results.length ? null : 'BCAI did not return question analysis.'
        ));
    } catch (error) {
        return questions.map(question => normalizeFinding({}, questionIdentity(question), error.message));
    }
}

function groupQuestions(questions) {
    const groups = new Map();
    for (const question of questions) {
        if (!groups.has(question.group)) groups.set(question.group, []);
        groups.get(question.group).push(question);
    }
    return groups;
}

function questionIdentity(question) {
    return {
        id: question.id,
        name: question.questionText,
        group: question.group,
        questionType: question.questionType,
        answerText: question.answerText,
        selectedOptions: question.selectedOptions,
        table: question.table,
        answered: question.answered
    };
}

export async function fineTuneSuggestion({ finding, instruction }) {
    if (!String(instruction || '').trim()) throw new Error('A fine-tune instruction is required.');
    const prompt = `${REVIEW_PROMPTS.FINE_TUNE}\n\nACP GUIDANCE:\n${ACP_REVIEW_GUIDANCE}\n\nORIGINAL FINDING:\n${JSON.stringify(finding)}\n\nUSER INSTRUCTION:\n${instruction}`;
    const parsed = extractJson(await sendPrompt(prompt));
    if (!parsed?.suggestedText && !parsed?.suggested_text) throw new Error('BCAI did not return a suggested answer.');
    return {
        suggestedText: parsed.suggestedText || parsed.suggested_text,
        changeSummary: parsed.changeSummary || parsed.change_summary || ''
    };
}

async function requestFinding(prompt, identity) {
    try {
        const parsed = extractJson(await sendPrompt(prompt));
        if (!parsed) throw new Error('BCAI returned unparseable review JSON.');
        return normalizeFinding(parsed, identity);
    } catch (error) {
        return normalizeFinding({}, identity, error.message);
    }
}

function normalizeFinding(value, identity, error = null) {
    const state = STATES.has(value.state) ? value.state : 'NEEDS_VERIFICATION';
    return {
        id: identity.id,
        name: identity.name || '',
        group: identity.group || '',
        questionType: identity.questionType || '',
        answerText: identity.answerText || '',
        selectedOptions: identity.selectedOptions || [],
        table: identity.table || null,
        answered: identity.answered,
        state,
        whatIsCorrect: toArray(value.whatIsCorrect ?? value.what_is_correct),
        whatIsWrong: toArray(value.whatIsWrong ?? value.what_is_wrong ?? (error ? [error] : [])),
        whyItMatters: value.whyItMatters ?? value.why_it_matters ?? '',
        howToImprove: toArray(value.howToImprove ?? value.how_to_improve),
        suggestedText: value.suggestedText ?? value.suggested_text ?? null,
        evidence: toArray(value.evidence),
        confidence: Number.isFinite(Number(value.confidence)) ? Number(value.confidence) : 0,
        requiresHumanVerification: value.requiresHumanVerification ?? value.requires_human_verification ?? true,
        questionsForApplicationTeam: toArray(value.questionsForApplicationTeam ?? value.questions_for_application_team)
    };
}

function toArray(value) {
    if (Array.isArray(value)) return value;
    return value == null || value === '' ? [] : [value];
}

function errorReview(message) {
    return { mode: 'review', generatedAt: new Date().toISOString(), checkpointAnalysis: [], questionAnalysis: [], newQuestions: [], error: message };
}
