import test from "node:test";
import assert from "node:assert/strict";

import { CHECKPOINTS } from "../core/checkpoint.js";
import { URLS } from "../utils/constants.js";
import { normalizeQuestionTable } from "../core/context.js";
import ACP8 from "../checkpoints/ACP8.js";
import ACP13 from "../checkpoints/ACP13.js";
import ACP15 from "../checkpoints/ACP15.js";
import ACP19 from "../checkpoints/ACP19.js";
import ACP23 from "../checkpoints/ACP23.js";

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
