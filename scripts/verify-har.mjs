import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildAnswerMap, buildQuestionMap } from "../api/apiClient.js";
import { CHECKPOINTS } from "../core/checkpoint.js";
import { buildNormalizedQuestions, createContext, normalizeQuestionTable } from "../core/context.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultFiles = [
    "FITT ACP survey survey cairois.web.boeing.com.har",
    "SND ACP cairois.web.boeing.com_Archive [26-10-06 19-29-22].har"
];
const files = process.argv.slice(2).length ? process.argv.slice(2) : defaultFiles;

function parseBody(entry) {
    try {
        const parsed = JSON.parse(entry?.response?.content?.text || "");
        return parsed && !Array.isArray(parsed) && Object.prototype.hasOwnProperty.call(parsed, "data") ? parsed.data : parsed;
    } catch {
        return null;
    }
}

function entriesAt(entries, predicate) {
    return entries.filter(entry => entry.response?.status === 200 && predicate(new URL(entry.request.url)));
}

function firstBody(entries, predicate, fallback = []) {
    return parseBody(entriesAt(entries, predicate)[0]) ?? fallback;
}

function largestCollector(entries, assessmentId, questionId) {
    return entriesAt(entries, url => url.pathname === `/node-api/survey/collector/${assessmentId}/question/${questionId}`)
        .map(parseBody)
        .filter(Boolean)
        .sort((a, b) => (b.collectedDataItems?.length || 0) - (a.collectedDataItems?.length || 0))[0] || null;
}

function collectorFromUpserts(entries, question) {
    const actionIds = new Set((question.actions || []).map(action => action.surveyTemplateActionId));
    const items = entriesAt(entries, url => url.pathname === "/node-api/survey/collector/data-collector/upsert/batch")
        .flatMap(entry => {
            try { return JSON.parse(entry.request.postData?.text || "[]"); } catch { return []; }
        })
        .filter(item => actionIds.has(item.surveyTemplateActionId));
    if (!items.length) return null;

    const uniqueItems = new Map();
    for (const item of items) {
        const key = [item.dataCollectorAssociationId, item.rowGroupNumber, item.dataCollectorOptionId || item.collectorValue].join("|");
        uniqueItems.set(key, item);
    }
    const collectors = new Map();
    for (const item of uniqueItems.values()) {
        if (!collectors.has(item.dataCollectorAssociationId)) {
            collectors.set(item.dataCollectorAssociationId, {
                dataCollectorAssociationId: item.dataCollectorAssociationId,
                sortOn: item.sortOn,
                collectorRequired: item.collectorRequired,
                multipleEntriesAllowed: item.multipleEntriesAllowed,
                dataCollector: {
                    shortDescription: item.shortDescription,
                    longDescription: item.longDescription,
                    collectorTypeDescriptionId: item.collectorTypeDescriptionId
                }
            });
        }
    }
    return {
        dataCollectors: [...collectors.values()],
        collectedDataItems: [...uniqueItems.values()].map(item => ({
            dataCollector: item,
            dataCollectorAssociation: {
                dataCollectorAssociationId: item.dataCollectorAssociationId,
                dataCollectorId: item.dataCollectorId
            },
            dataCollectorOption: (item.dataCollectorOptions || []).find(option => option.dataCollectorOptionId === item.dataCollectorOptionId) || null
        }))
    };
}

for (const requestedFile of files) {
    const file = path.resolve(root, requestedFile);
    const har = JSON.parse(await readFile(file, "utf8"));
    const entries = har.log.entries;
    const detail = firstBody(entries, url => /^\/api\/assessment\/\d+\/detail$/.test(url.pathname), {});
    const assessmentId = detail.assessmentId;
    const questions = firstBody(entries, url => /\/node-api\/survey\/template\/\d+\/questions$/.test(url.pathname));
    const answersPayload = firstBody(entries, url => url.pathname === `/api/assessment/survey/${assessmentId}/answers`, {});
    const answers = answersPayload.answers || answersPayload || [];
    const assetLabels = firstBody(entries, url => url.pathname === "/api/asset/label/search");
    const assets = firstBody(entries, url => url.pathname === `/node-api/assessments/${assessmentId}/assets`);
    const assetId = String(assets[0]?.assetId || "");
    const questionMap = buildQuestionMap(questions);
    const answerMap = buildAnswerMap(answers);
    const questionDetails = {};
    const questionTables = {};

    for (const question of questions) {
        const alias = question.alternateQuestionId || String(question.surveyTemplateQuestionId);
        let collector = largestCollector(entries, assessmentId, question.surveyTemplateQuestionId);
        if (!collector?.collectedDataItems?.length) collector = collectorFromUpserts(entries, question) || collector;
        if (!collector) continue;
        questionDetails[alias] = collector;
        questionTables[alias] = normalizeQuestionTable(collector, assetLabels);
    }

    const cedPublic = {};
    for (const entry of entriesAt(entries, url => url.pathname === "/node-api/identity/ced")) {
        const url = new URL(entry.request.url);
        cedPublic[url.searchParams.get("bemsId")] = parseBody(entry);
    }

    const supportingData = {
        reviewSummaries: firstBody(entries, url => url.pathname.includes("/assessment/review/summaries")),
        assets,
        questionDetails,
        questionTables,
        roleRows: questionTables["ACP-AR1"]?.rows || [],
        databaseApproverRows: questionTables["ACP-RAP4"]?.rows || [],
        esatsRoles: firstBody(entries, url => url.pathname === "/api/esatsBusappPersonRole01"),
        esatsBusapp: firstBody(entries, url => url.pathname === "/api/esatsBusapp"),
        assetLabels,
        gsepDatabases: firstBody(entries, url => url.pathname === "/api/gsepDatabase", { error: "not captured" }),
        sisServerIds: firstBody(entries, url => url.pathname === "/api/sisServerBseId", { error: "not captured" }),
        sisServers: firstBody(entries, url => url.pathname === "/api/sisAllRecords", { error: "not captured" }),
        cedPublic
    };
    const normalizedQuestions = buildNormalizedQuestions(questions, answerMap, questionTables, questionDetails);
    const context = createContext({
        assessment: { assessmentId, assetId }, detail, questions, answers, questionMap, answerMap, supportingData, normalizedQuestions
    });

    const statuses = [];
    for (const checkpoint of CHECKPOINTS.filter(item => item.type === "RULE")) {
        const result = await checkpoint.validate(context);
        statuses.push(`${checkpoint.id}:${result.status}`);
    }
    console.log(`${path.basename(file)} | roles=${context.roleRows.length} npi=${questionTables["ACP-NPI1"]?.rows?.length || 0} | ${statuses.join(" ")}`);
}
