/** Modular ACP review workflow built on the checkpoint registry and normalized context. */
import { getAllCheckpoints } from './checkpoint.js';
import { sendPrompt, extractJson, createConversationSession } from '../ai/aiService.js';
import {
    CONFIG,
    REVIEW_PROMPTS,
    REVIEW_QUESTION_IDS,
    REVIEW_TABLE_CONFIGS,
    REVIEW_QUESTION_FORMATS
} from '../utils/constants.js';
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

export async function reviewContext(context, isCancelled, onProgress, options = {}) {
    const assessmentId = context.assessment?.assessmentId || context.detail?.assessmentId || 'unknown';
    const session = options.session || createConversationSession(`review-${assessmentId}`);
    const auditorSession = options.auditorSession || createConversationSession(`auditor-${assessmentId}`);
    const signal = options.signal || null;
    const questionAnalysis = [];
    const reviewQuestionIds = new Set(REVIEW_QUESTION_IDS);
    const reviewableQuestions = (context.normalizedQuestions || []).filter(question =>
        question.answered && (question.aliases || []).some(alias => reviewQuestionIds.has(String(alias)))
    );
    for (const question of reviewableQuestions) {
        if (isCancelled && await isCancelled()) break;
        await onProgress?.(`Analyzing question ${question.id}: ${question.questionText}`);
        questionAnalysis.push(await reviewQuestion(question, context, {
            session,
            auditorSession,
            signal
        }));
    }

    return {
        mode: 'review',
        generatedAt: new Date().toISOString(),
        questionAnalysis,
        // Extension point for future question-generation logic.
        newQuestions: [],
        summary: summarizeReview(questionAnalysis),
        conversationId: session.guid,
        auditorConversationId: auditorSession.guid
    };
}

function summarizeReview(questions) {
    const countStates = findings => findings.reduce((counts, finding) => {
        counts[finding.state] = (counts[finding.state] || 0) + 1;
        return counts;
    }, {});
    return {
        questionCount: questions.length,
        questionStates: countStates(questions),
        answeredQuestions: questions.filter(question => question.answered).length,
        questionsWithSuggestions: questions.filter(question => question.suggestedText).length
    };
}

async function reviewQuestion(question, context, aiOptions) {
    const crossSection = {
        assessment: context.assessment,
        roleQuestion: context.normalizedQuestionMap?.get('ACP-AR1') || null,
        riskProfilerLabels: context.supportingData?.assetLabels || [],
        esatsDescription: context.supportingData?.esatsBusapp || null
    };
    const relatedCheckpoints = await buildRelatedCheckpointContext(
        question,
        context
    );
    const evidence = { crossSection, question, relatedCheckpoints };
    const tableConfigId = (question.aliases || []).find(alias => REVIEW_TABLE_CONFIGS[String(alias)]);
    const formatConfigId = (question.aliases || []).find(alias => REVIEW_QUESTION_FORMATS[String(alias)]);
    const questionFormat = REVIEW_QUESTION_FORMATS[String(formatConfigId)] || null;
    const tableInstruction = tableConfigId
        ? `\n\nTABLE OUTPUT REQUIREMENT FOR ${tableConfigId}:\n${REVIEW_PROMPTS.TABLE_QUESTION}\nCOLUMN KEYS AND ORDER:\n${JSON.stringify((question.table?.columns || []).map(column => ({ key: column.key, label: column.label })))}`
        : '';
    const formatInstruction = questionFormat === 'rich_text'
        ? `\n\nANSWER FORMAT REQUIREMENT FOR ${formatConfigId}:\n${REVIEW_PROMPTS.RICH_TEXT_QUESTION}`
        : questionFormat === 'yes_no'
            ? `\n\nANSWER FORMAT REQUIREMENT FOR ${formatConfigId}:\n${REVIEW_PROMPTS.YES_NO_QUESTION}`
            : '';
    const prompt = `${REVIEW_PROMPTS.QUESTION_WISE}${tableInstruction}${formatInstruction}\n\nACP GUIDANCE:\n${ACP_REVIEW_GUIDANCE}\n\nRELATED CHECKPOINT CONTEXT (all checkpoints that depend on this question):\n${JSON.stringify(relatedCheckpoints)}\n\nCROSS-SECTION EVIDENCE:\n${JSON.stringify(crossSection)}\n\nQUESTION:\n${JSON.stringify(question)}`;
    return requestAuditedFinding(prompt, questionIdentity(question), evidence, aiOptions);
}

async function buildRelatedCheckpointContext(question, context) {
    const relatedIds = new Set(getRelatedCheckpointIds(question.aliases || []));
    const related = getAllCheckpoints().filter(checkpoint => relatedIds.has(checkpoint.id));

    return Promise.all(related.map(async checkpoint => {
        let criterion = null;
        let deterministicResult = null;
        let contextError = null;
        try {
            if (typeof checkpoint.buildPrompt === 'function') {
                criterion = checkpoint.buildPrompt(context);
            }
            if (checkpoint.type !== 'AI' && typeof checkpoint.validate === 'function') {
                deterministicResult = await checkpoint.validate(context);
            }
        } catch (error) {
            contextError = error.message;
        }

        return {
            checkpointId: checkpoint.id,
            checkpointName: checkpoint.name,
            category: checkpoint.category || 'General',
            type: checkpoint.type || 'UNKNOWN',
            evidenceQuestionIds: CHECKPOINT_EVIDENCE[checkpoint.id] || [],
            criterion,
            deterministicResult,
            relatedQuestionEvidence: (CHECKPOINT_EVIDENCE[checkpoint.id] || [])
                .map(id => context.normalizedQuestionMap?.get(String(id)))
                .filter(Boolean),
            contextError
        };
    }));
}

export function getRelatedCheckpointIds(questionAliases) {
    const aliases = new Set((questionAliases || []).map(String));
    return getAllCheckpoints()
        .filter(checkpoint =>
            (CHECKPOINT_EVIDENCE[checkpoint.id] || []).some(id => aliases.has(String(id)))
        )
        .map(checkpoint => checkpoint.id);
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
        answerFormat: (question.aliases || [])
            .map(alias => REVIEW_QUESTION_FORMATS[String(alias)])
            .find(Boolean) || null,
        answered: question.answered
    };
}

export async function fineTuneSuggestion({ finding, instruction }) {
    if (!String(instruction || '').trim()) throw new Error('A fine-tune instruction is required.');
    const prompt = `${REVIEW_PROMPTS.FINE_TUNE}\n\nACP GUIDANCE:\n${ACP_REVIEW_GUIDANCE}\n\nORIGINAL FINDING:\n${JSON.stringify(finding)}\n\nUSER INSTRUCTION:\n${instruction}`;
    const parsed = extractJson(await sendPrompt(prompt));
    const candidate = parsed?.finding || parsed?.review || parsed;
    const suggestedTable = normalizeSuggestedTable(candidate, finding);
    if (!candidate?.suggestedText && !candidate?.suggested_text && !suggestedTable) {
        throw new Error('BCAI did not return a suggested answer.');
    }
    return {
        suggestedText: candidate.suggestedText || candidate.suggested_text || finding.suggestedText || '',
        suggestedOption: normalizeSuggestedOption(candidate.suggestedOption ?? candidate.suggested_option) ||
            finding.suggestedOption ||
            null,
        suggestedTable: suggestedTable || finding.suggestedTable || null,
        changeSummary: candidate.changeSummary || candidate.change_summary || ''
    };
}

async function requestAuditedFinding(prompt, identity, evidence, { session, auditorSession, signal }) {
    const primary = await requestFinding(prompt, identity, { session, signal });
    if (signal?.aborted) return primary;
    if (primary.error) return primary;

    const auditPrompt = `${REVIEW_PROMPTS.AUDITOR}\n\nACP GUIDANCE:\n${ACP_REVIEW_GUIDANCE}\n\nIDENTITY:\n${JSON.stringify(identity)}\n\nEVIDENCE:\n${JSON.stringify(evidence)}\n\nFINDING TO AUDIT:\n${JSON.stringify(primary)}`;
    const audited = await requestFinding(auditPrompt, identity, { session: auditorSession, signal });
    if (audited.error) {
        return {
            ...primary,
            requiresHumanVerification: true,
            audit: { verified: false, error: audited.error }
        };
    }
    return {
        ...audited,
        suggestedOption: audited.suggestedOption || primary.suggestedOption || null,
        suggestedTable: audited.suggestedTable || primary.suggestedTable || null,
        audit: { verified: true, originalState: primary.state }
    };
}

async function requestFinding(prompt, identity, { session, signal }) {
    let lastError = null;
    for (let attempt = 1; attempt <= CONFIG.AI_RETRY_ATTEMPTS; attempt++) {
        try {
            const parsed = extractJson(await sendPrompt(prompt, { session, signal }));
            if (!parsed) throw new Error('BCAI returned unparseable review JSON.');
            const candidate = Array.isArray(parsed)
                ? parsed[0]
                : parsed.finding || parsed.analysis || parsed.review || parsed;
            return normalizeFinding(candidate, identity);
        } catch (error) {
            if (signal?.aborted || error?.name === 'AbortError') throw error;
            lastError = error;
        }
    }
    return normalizeFinding({}, identity, lastError?.message || 'BCAI review failed.');
}

function normalizeFinding(value, identity, error = null) {
    const proposedState = String(value?.state || '').toUpperCase();
    const state = STATES.has(proposedState) ? proposedState : 'NEEDS_VERIFICATION';
    return {
        id: identity.id,
        name: identity.name || '',
        group: identity.group || '',
        questionType: identity.questionType || '',
        answerFormat: identity.answerFormat || null,
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
        suggestedOption: normalizeSuggestedOption(value.suggestedOption ?? value.suggested_option),
        suggestedTable: normalizeSuggestedTable(value, identity),
        evidence: toArray(value.evidence),
        confidence: Number.isFinite(Number(value.confidence)) ? Number(value.confidence) : 0,
        requiresHumanVerification: value.requiresHumanVerification ?? value.requires_human_verification ?? true,
        questionsForApplicationTeam: toArray(value.questionsForApplicationTeam ?? value.questions_for_application_team),
        error
    };
}

function normalizeSuggestedOption(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return ['YES', 'NO', 'NEEDS_VERIFICATION'].includes(normalized) ? normalized : null;
}

export function normalizeSuggestedTable(value, identity) {
    if (!identity?.table?.columns?.length) return null;
    const rawRows = value?.suggestedTableRows ??
        value?.suggested_table_rows ??
        value?.suggestedTable?.rows ??
        value?.suggested_table?.rows;
    if (!Array.isArray(rawRows) || !rawRows.length) return null;

    const columns = identity.table.columns.slice(0, 30).map(column => ({
        key: String(column.key || ''),
        label: String(column.label || column.key || '')
    })).filter(column => column.key);
    const rows = rawRows.slice(0, 100).map((row, index) => {
        const structuredCells = Array.isArray(row?.cells) ? row.cells : [];
        const cells = columns.map(column => {
            const structured = structuredCells.find(cell => String(cell?.key) === column.key);
            const rawValue = structured?.values ?? structured?.value ?? row?.[column.key];
            return {
                key: column.key,
                values: normalizeSuggestedCellValues(rawValue)
            };
        });
        return {
            rowGroupNumber: String(row?.rowGroupNumber ?? row?.row_group_number ?? index),
            cells
        };
    });
    return { columns, rows };
}

function normalizeSuggestedCellValues(value) {
    const values = Array.isArray(value) ? value : value == null ? [] : [value];
    return values.slice(0, 20).map(item => {
        const raw = typeof item === 'object' && item !== null ? item.value : item;
        return { value: String(raw ?? '').trim().slice(0, 4000) };
    }).filter(item => item.value);
}

function toArray(value) {
    if (Array.isArray(value)) return value;
    return value == null || value === '' ? [] : [value];
}

function errorReview(message) {
    return { mode: 'review', generatedAt: new Date().toISOString(), questionAnalysis: [], newQuestions: [], error: message };
}
