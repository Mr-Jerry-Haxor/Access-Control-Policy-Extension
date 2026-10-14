import test from "node:test";
import assert from "node:assert/strict";

import { CHECKPOINTS } from "../core/checkpoint.js";
import { BCAI, URLS } from "../utils/constants.js";
import { normalizeQuestionTable } from "../core/context.js";
import { extractRiskProfilerAnswers, selectRiskProfilerAssessment } from "../api/apiClient.js";
import { buildBcaiResponsesPayload, parseBcaiResponse, parseBcaiResponseDetails } from "../ai/aiService.js";
import ACP8 from "../checkpoints/ACP8.js";
import ACP9 from "../checkpoints/ACP9.js";
import ACP10 from "../checkpoints/ACP10.js";
import ACP5 from "../checkpoints/ACP5.js";
import ACP6 from "../checkpoints/ACP6.js";
import ACP7 from "../checkpoints/ACP7.js";
import ACP13 from "../checkpoints/ACP13.js";
import ACP14 from "../checkpoints/ACP14.js";
import ACP15 from "../checkpoints/ACP15.js";
import ACP16 from "../checkpoints/ACP16.js";
import ACP17 from "../checkpoints/ACP17.js";
import ACP18 from "../checkpoints/ACP18.js";
import ACP19 from "../checkpoints/ACP19.js";
import ACP23 from "../checkpoints/ACP23.js";
import ACP24 from "../checkpoints/ACP24.js";
import ACP25 from "../checkpoints/ACP25.js";
import ACP26 from "../checkpoints/ACP26.js";
import ACP27 from "../checkpoints/ACP27.js";
import ACP28 from "../checkpoints/ACP28.js";
import ACP29 from "../checkpoints/ACP29.js";

function contextWithRoles(roleRows, supportingData = {}) {
    return {
        roleRows,
        supportingData: { roleRows, ...supportingData },
        getAnswerText: id => supportingData.answers?.[id] || ""
    };
}

test("registry follows the authoritative checkpoint order", () => {
    const expected = Array.from({ length: 29 }, (_, index) => `ACP${index + 1}`);
    assert.deepEqual(CHECKPOINTS.map(checkpoint => checkpoint.id), expected);
    assert.equal(CHECKPOINTS.length, 29);
    assert.ok(CHECKPOINTS.filter(checkpoint => checkpoint.type === "RULE").length > CHECKPOINTS.filter(checkpoint => checkpoint.type === "AI").length);
    assert.equal(new Set(CHECKPOINTS.map(checkpoint => checkpoint.reviewPrompt)).size, CHECKPOINTS.length);
});

test("HAR-confirmed node-api routes are configured", () => {
    assert.match(URLS.PRIMARY_ACPS, /\/node-api\/assets\/4\/82\/assessment\/type\/48$/);
    assert.match(URLS.ACP_QUESTIONS, /\/node-api\/survey\/template\/\{id\}\/questions$/);
    assert.match(URLS.ACP_SURVEY_QUESTION, /\/node-api\/survey\/collector\/\{assessmentId\}\/question\/\{questionId\}$/);
    assert.match(URLS.CED_PUBLIC, /\/node-api\/identity\/ced\?bemsId=\{bemsId\}$/);
    assert.match(URLS.RISK_PROFILER_ASSESSMENTS, /\/node-api\/assets\/4\/82\/assessment\/type\/35$/);
    assert.match(URLS.RISK_PROFILER_ANSWERS, /\/api\/assessment\/survey\/\{id\}\/answers$/);
});

test("Risk Profiler evidence requires both asset ID and asset name and uses last assessment answers", () => {
    const rows = [
        { assetId: "42", assetName: "Wrong name", lastAssessmentId: 100 },
        { assetId: "99", assetName: "Target", lastAssessmentId: 200 },
        { assetId: "42", assetName: "Target", lastAssessmentId: 300 }
    ];
    assert.equal(selectRiskProfilerAssessment(rows, "42", "Target").lastAssessmentId, 300);
    assert.equal(selectRiskProfilerAssessment(rows, "42", "Wrong target"), null);

    const answers = extractRiskProfilerAnswers([
        { alternateQuestionId: "CSIR-IPOwner", assessmentSurveyAnswerId: 1, answerOptions: [{ internalValue: "Non-Boeing" }] },
        { alternateQuestionId: "CSIR-IPOwner", assessmentSurveyAnswerId: 2, answerOptions: [{ internalValue: "Boeing" }] },
        { alternateQuestionId: "CSIR-SvcAcct", answerOptions: [{ internalValue: "Yes" }] },
        { alternateQuestionId: "CSIR-AppType", answerOptions: [{ internalValue: "Web application" }, { internalValue: "Client-Server" }] },
        { alternateQuestionId: "CSIR-Database", answerOptions: [{ internalValue: "No" }] }
    ]);
    assert.equal(answers["CSIR-IPOwner"], "Boeing");
    assert.equal(answers["CSIR-SvcAcct"], "Yes");
    assert.deepEqual(answers["CSIR-AppType"], ["Web application", "Client-Server"]);
    assert.equal(answers["CSIR-Database"], "No");
});

test("ACP9 uses the exact Risk Profiler CSIR-IPOwner answer", async () => {
    const boeing = await ACP9.validate(contextWithRoles(
        [{ role: "Software Developer" }],
        { riskProfiler: { status: "found", answers: { "CSIR-IPOwner": "Boeing" } } }
    ));
    assert.equal(boeing.status, "PASS");

    const nonBoeing = await ACP9.validate(contextWithRoles(
        [{ role: "Application User" }],
        { riskProfiler: { status: "found", answers: { "CSIR-IPOwner": "Non-Boeing" } } }
    ));
    assert.equal(nonBoeing.status, "N/A");
});

test("ACP16 compares ACP-NPI1 with the same Risk Profiler assessment answers", async () => {
    const matching = await ACP16.validate(contextWithRoles([], {
        answers: { "ACP-NPI1": "Yes" },
        riskProfiler: { status: "found", answers: { "CSIR-SvcAcct": "Yes" } }
    }));
    assert.equal(matching.status, "PASS");

    const mismatch = await ACP16.validate(contextWithRoles([], {
        answers: { "ACP-NPI1": "No" },
        riskProfiler: { status: "found", answers: { "CSIR-SvcAcct": "Yes" } }
    }));
    assert.equal(mismatch.status, "FAIL");
});

test("ACP17 uses Risk Profiler application type and database evidence", async () => {
    const passResult = await ACP17.validate(contextWithRoles([], {
        answers: { "ACP-NPI1": "Yes" },
        questionTables: { "ACP-NPI1": { rows: [{ nonPersonIdentifier: "svc-app" }] } },
        riskProfiler: {
            status: "found",
            assessmentId: 300,
            answers: { "CSIR-AppType": ["Web application"], "CSIR-Database": "No" }
        }
    }));
    assert.equal(passResult.status, "PASS");

    const failResult = await ACP17.validate(contextWithRoles([], {
        answers: { "ACP-NPI1": "Yes" },
        riskProfiler: {
            status: "found",
            assessmentId: 300,
            answers: { "CSIR-AppType": ["Desktop application"], "CSIR-Database": "Yes" }
        }
    }));
    assert.equal(failResult.status, "FAIL");

    const notApplicable = await ACP17.validate(contextWithRoles([], {
        answers: { "ACP-NPI1": "No" },
        riskProfiler: {
            status: "found",
            assessmentId: 300,
            answers: { "CSIR-AppType": ["Desktop application"], "CSIR-Database": "No" }
        }
    }));
    assert.equal(notApplicable.status, "N/A");

    const review = await ACP17.validate(contextWithRoles([], {
        answers: { "ACP-NPI1": "Yes" },
        riskProfiler: { status: "found", assessmentId: 300, answers: { "CSIR-AppType": ["Desktop application"] } }
    }));
    assert.equal(review.status, "REVIEW");
});

test("ACP17, ACP18, and ACP19 are N/A when ACP-NPI1 is No", async () => {
    const context = contextWithRoles([], { answers: { "ACP-NPI1": "No" } });
    for (const checkpoint of [ACP17, ACP18, ACP19]) {
        const result = await checkpoint.validate(context);
        assert.equal(result.status, "N/A", checkpoint.id);
        assert.match(result.message, /ACP-NPI1 is No/, checkpoint.id);
    }
});

test("ACP18 asks AI for specific action-and-purpose Function descriptions", () => {
    const prompt = ACP18.buildPrompt(contextWithRoles([], {
        answers: { "ACP-NPI1": "Yes" },
        questionTables: { "ACP-NPI1": { rows: [{
            rowGroupNumber: "2",
            nonPersonIdentifier: "svc-order-sync",
            function: "Processes data",
            nonPersonAccountOwner: "12345",
            rawItems: [{ secret: "must-not-be-sent" }]
        }] } }
    }));
    assert.match(prompt, /concrete action the account performs/);
    assert.match(prompt, /application-specific purpose, system, resource, data flow, job, integration/);
    assert.match(prompt, /The mere presence of an action verb is not sufficient/);
    assert.match(prompt, /generic short descriptions/);
    assert.match(prompt, /identify each deficient NPI/);
    assert.match(prompt, /svc-order-sync/);
    assert.doesNotMatch(prompt, /rawItems|must-not-be-sent/);
});

test("BCAI gpt-6-luna payload follows the HAR-confirmed Responses contract", () => {
    const payload = buildBcaiResponsesPayload(
        { guid: "test-guid" },
        "gpt-6-luna",
        [
            { role: "user", content: [{ type: "text", text: "Question" }] },
            { role: "assistant", content: [{ type: "text", text: "Answer" }] }
        ]
    );

    assert.match(BCAI.ENDPOINT, /\/genai-backend-api\/responses$/);
    assert.deepEqual(Object.keys(payload), ["bcai_options", "model", "input", "stream"]);
    assert.deepEqual(BCAI.DATA_SOURCES, ["Information Technology Command Media"]);
    assert.deepEqual(payload.bcai_options.data_sources, ["Information Technology Command Media"]);
    assert.equal(payload.input[0].content[0].type, "input_text");
    assert.equal(payload.input[1].content[0].type, "output_text");
    assert.equal(payload.bcai_options.database_options.save_to_database, false);
    assert.equal("reasoning_effort" in payload, false);
    assert.equal("response_max_tokens" in payload, false);
});

test("BCAI parser joins Responses API output text deltas", () => {
    const assistantItem = {
        id: "msg_test",
        type: "message",
        status: "completed",
        phase: "final_answer",
        role: "assistant",
        content: [{ type: "output_text", text: "Hello world", annotations: [], logprobs: [] }]
    };
    const raw = [
        JSON.stringify({ type: "response.output_text.delta", delta: "Hello" }),
        JSON.stringify({ type: "response.output_text.delta", delta: " world" }),
        JSON.stringify({ type: "response.output_item.done", item: assistantItem }),
        JSON.stringify({
            type: "response.completed",
            response: {
                id: "resp_test",
                model: "gpt-6-luna",
                status: "completed",
                error: null,
                incomplete_details: null,
                usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 }
            }
        })
    ].join("\n");
    assert.equal(parseBcaiResponse(raw), "Hello world");
    const details = parseBcaiResponseDetails(raw);
    assert.equal(details.outputItem.id, "msg_test");
    assert.equal(details.status, "completed");
    assert.equal(details.usage.total_tokens, 12);
    assert.equal(details.responseId, "resp_test");
    assert.equal(details.model, "gpt-6-luna");

    const followUp = buildBcaiResponsesPayload(
        { guid: "test-guid" },
        "gpt-6-luna",
        [assistantItem, { role: "user", content: [{ type: "text", text: "Next" }] }]
    );
    assert.equal(followUp.input[0].id, "msg_test");
    assert.equal(followUp.input[0].status, "completed");
    assert.equal(followUp.input[0].phase, "final_answer");
});

test("BCAI parser exposes failed and incomplete terminal states", () => {
    const failed = parseBcaiResponseDetails(JSON.stringify({
        type: "response.failed",
        response: { status: "failed", error: { code: "provider_error", message: "Unavailable" } }
    }));
    assert.equal(failed.status, "failed");
    assert.equal(failed.error.code, "provider_error");

    const incomplete = parseBcaiResponseDetails(JSON.stringify({
        type: "response.incomplete",
        response: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }
    }));
    assert.equal(incomplete.status, "incomplete");
    assert.equal(incomplete.incompleteDetails.reason, "max_output_tokens");
});

test("collector payload normalizes role rows and option values", () => {
    const detail = {
        dataCollectors: [
            { dataCollectorAssociationId: 1, sortOn: 1, dataCollector: { shortDescription: "Role" } },
            { dataCollectorAssociationId: 2, sortOn: 2, dataCollector: { shortDescription: "Environment" } }
        ],
        collectedDataItems: [
            { dataCollector: { dataCollectorAssociationId: 1, rowGroupNumber: "0", resolvedCollectorValue: "Developer" } },
            { dataCollector: { dataCollectorAssociationId: 2, rowGroupNumber: "0" }, dataCollectorOption: { displayValue: "Production" } }
        ]
    };
    const table = normalizeQuestionTable(detail);
    assert.equal(table.rows[0].role, "Developer");
    assert.equal(table.rows[0].environment, "Production");
});

test("ACP13 requires a non-None access level on every row", async () => {
    const result = await ACP13.validate(contextWithRoles([
        { role: "Reader", accessToDB: "None", accessToServer: "None", accessToApplication: "Read" },
        { role: "Broken", accessToDB: "None", accessToServer: "None", accessToApplication: "None" }
    ]));
    assert.equal(result.status, "FAIL");
    assert.match(result.message, /Broken/);
});

test("ACP5 keeps deterministic pass and no-database outcomes", async () => {
    const noDatabase = await ACP5.validate(contextWithRoles([], { gsepDatabases: [] }));
    assert.equal(noDatabase.status, "N/A");

    const withDba = await ACP5.validate(contextWithRoles(
        [{ role: "Application DBA" }],
        { gsepDatabases: [{ databaseName: "APPDB" }] }
    ));
    assert.equal(withDba.status, "PASS");
});

test("ACP5 failure prompt asks AI to verify ACP-AI2", async () => {
    const context = contextWithRoles(
        [{ role: "Application User" }],
        {
            gsepDatabases: [{ databaseName: "Speed DB" }],
            answers: {
                "ACP-AI2": "DCMS uses the Speed Application database, and the DBA role is documented under the Speed Application ACP."
            }
        }
    );
    const result = await ACP5.validate(context);
    assert.equal(result.status, "FAIL");
    assert.match(result.message, /AI verification/);

    const prompt = ACP5.buildFailurePrompt(context);
    assert.match(prompt, /ACP-AI2/);
    assert.match(prompt, /DCMS uses the Speed Application database/);
    assert.match(prompt, /shared database owned and administered under another application's ACP/);
});

test("ACP6 inherits only ACP5's AI-approved no-DBA N/A exception", async () => {
    const supportingData = { gsepDatabases: [{ databaseName: "Speed DB" }] };
    const acceptedException = contextWithRoles([{ role: "Application User" }], supportingData);
    acceptedException.checkpointResults = new Map([["ACP5", {
        status: "N/A",
        conditionalAiFallback: true
    }]]);
    const skipped = await ACP6.validate(acceptedException);
    assert.equal(skipped.status, "N/A");
    assert.match(skipped.message, /ACP-AI2/);

    const unrelatedNa = contextWithRoles([{ role: "Application User" }], supportingData);
    unrelatedNa.checkpointResults = new Map([["ACP5", { status: "N/A" }]]);
    const failed = await ACP6.validate(unrelatedNa);
    assert.equal(failed.status, "FAIL");
    assert.match(failed.message, /No DBA role/);
});

test("ACP7 preserves deterministic outcomes and asks AI to verify ACP-AI2 only on failure", async () => {
    const noTierSupport = await ACP7.validate(contextWithRoles([], { esatsRoles: [] }));
    assert.equal(noTierSupport.status, "N/A");

    const withSupportRole = await ACP7.validate(contextWithRoles(
        [{ role: "Application Support" }],
        { esatsRoles: [{ roleType: "Tier 2/3 Technical Support" }] }
    ));
    assert.equal(withSupportRole.status, "PASS");

    const exceptionContext = contextWithRoles(
        [{ role: "Application User" }],
        {
            esatsRoles: [{ roleType: "Tier 2/3 Technical Support" }],
            answers: {
                "ACP-AI2": "Tier 2/3 support is provided by the shared platform support team and documented in that platform's ACP."
            }
        }
    );
    const failed = await ACP7.validate(exceptionContext);
    assert.equal(failed.status, "FAIL");
    assert.match(failed.message, /AI verification/);

    const prompt = ACP7.buildFailurePrompt(exceptionContext);
    assert.match(prompt, /ACP-AI2/);
    assert.match(prompt, /shared platform support team/);
    assert.match(prompt, /Return NA only/);
});

test("ACP23 compares data type within each Non-US role row", async () => {
    const result = await ACP23.validate(contextWithRoles([
        { role: "Non-US Reader", personStatus: "Non-US Person", dataType: "Boeing Proprietary" },
        { role: "US Reader", personStatus: "US Person", dataType: "US Export - Not Yet Determined" }
    ]));
    assert.equal(result.status, "PASS");
});

test("ACP15 detects a missing CMDB server environment", async () => {
    const result = await ACP15.validate(contextWithRoles(
        [{ role: "Administrator", environment: ["Production", "Development"] }],
        { sisServers: [{ environment: "Production" }, { environment: "Test" }] }
    ));
    assert.equal(result.status, "FAIL");
    assert.match(result.message, /test/i);
});

test("ACP15 maps detailed CMDB values to the nine selectable CAIRO environments", async () => {
    const selected = [
        "Business Unit Lab", "Cold Spare", "Development", "Disaster Recovery", "Install/Build",
        "Lab General", "Pre-production", "Production", "Test"
    ];
    const result = await ACP15.validate(contextWithRoles(
        [{ role: "Administrator", environment: [...selected, "Extra ACP Environment"] }],
        { sisServers: [
            { environment: "Business Unit Lab - North" },
            { environment: "Cold Spare" },
            { environment: "DEV / QA" },
            { environment: "DR" },
            { environment: "Install Build" },
            { environment: "General Lab" },
            { environment: "UAT / Staging" },
            { environment: "Production - Primary" }
        ] }
    ));
    assert.equal(result.status, "PASS");
    assert.match(result.message, /Additional ACP environments are allowed/);
});

test("ACP15 reviews CMDB environments that have no selectable CAIRO mapping", async () => {
    const result = await ACP15.validate(contextWithRoles(
        [{ role: "Administrator", environment: ["Production"] }],
        { sisServers: [{ environment: "Production" }, { environment: "Training" }, { environment: "Non-Production" }] }
    ));
    assert.equal(result.status, "REVIEW");
    assert.match(result.message, /Training/);
    assert.match(result.message, /Non-Production/);
});

test("ACP19 accepts active CED object responses for all NPI owners", async () => {
    const result = await ACP19.validate({
        getAnswerText: () => "Yes",
        supportingData: {
            questionTables: { "ACP-NPI1": { rows: [{ nonPersonIdentifier: "svc", nonPersonAccountOwner: "12345" }] } },
            cedPublic: { "12345": { status: "A" } }
        }
    });
    assert.equal(result.status, "PASS");
});

test("AI role evidence is formatted JSON without raw collector objects", () => {
    const prompt = ACP8.buildPrompt(contextWithRoles([{
        rowGroupNumber: "0",
        role: "Developer",
        responsibility: "Creates application code",
        environment: ["Development"],
        rawItems: [{ secret: "must-not-be-sent" }]
    }]));
    assert.match(prompt, /"accessRoles"/);
    assert.match(prompt, /"role": \[/);
    assert.doesNotMatch(prompt, /rawItems|must-not-be-sent/);
});

test("ACP10 asks AI to evaluate all same-row fields without requiring Application Admin", () => {
    const prompt = ACP10.buildPrompt(contextWithRoles([{
        role: "Data Viewer",
        responsibility: "Views approved records",
        environment: ["Production"],
        authorizedEntity: "Finance analysts",
        personStatus: "U.S. Person",
        personType: "Employee",
        accessToDB: "None",
        accessToServer: "None",
        accessToApplication: "Read",
        dataType: "Boeing Proprietary"
    }]));
    assert.match(prompt, /Evaluate every ACP-AR1 row separately/);
    assert.match(prompt, /Application Admin is only an example/);
    assert.match(prompt, /DBA or Database Administrator role, database Write, Elevated, or Admin access/);
    assert.match(prompt, /do not require Admin access/);
    assert.match(prompt, /"accessToApplication": \[\s*"Read"/);
    assert.doesNotMatch(prompt, /rawItems/);
});

test("ACP14 asks AI to compare responsibility claims with the correct scoped access field", () => {
    const prompt = ACP14.buildPrompt(contextWithRoles([{
        role: "Server Administrator",
        responsibility: "Performs local administrator maintenance on production hosts",
        accessToDB: "None",
        accessToServer: "Root",
        accessToApplication: "None"
    }]));
    assert.match(prompt, /compare it only with the corresponding accessToDB, accessToServer, or accessToApplication/);
    assert.match(prompt, /Read = read, view, read-only/);
    assert.match(prompt, /Write = write, modify, read\/write/);
    assert.match(prompt, /Elevated = elevated, privileged/);
    assert.match(prompt, /Admin = admin, full control/);
    assert.match(prompt, /Root = root, superuser, UID 0/);
    assert.match(prompt, /local administrator and server administrator wording as OS-level privileged access/);
    assert.match(prompt, /Return NA only when none/);
    assert.match(prompt, /"accessToServer": \[\s*"Root"/);
});

test("ACP24 through ACP29 evaluate ACP-AI2 exceptions even when the primary process is missing", () => {
    const exception = "The Service Reader role is provisioned automatically by the managed platform; the platform owner performs approval and removal under its documented control.";
    const context = contextWithRoles([{ role: "Service Reader" }], {
        answers: { "ACP-AI2": exception }
    });
    context.detail = {};

    for (const checkpoint of [ACP24, ACP25, ACP26, ACP27, ACP28, ACP29]) {
        const prompt = checkpoint.buildPrompt(context);
        assert.ok(prompt, `${checkpoint.id} should evaluate an ACP-AI2-only exception`);
        assert.match(prompt, /additionalInformationQuestion/);
        assert.match(prompt, /ACP-AI2/);
        assert.match(prompt, /managed platform/);
        assert.match(prompt, /presence alone does not waive the checkpoint/);
        assert.match(prompt, /role-specific exception excludes only the clearly named scope/);
        assert.match(prompt, /Return NA only when a clear, specific, evidence-supported exception makes the entire checkpoint not applicable/);
    }
});
