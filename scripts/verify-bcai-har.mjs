import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const harPath = path.join(root, 'boeingai.web.boeing.com.har');
const har = JSON.parse(await readFile(harPath, 'utf8'));
const entries = har?.log?.entries || [];
const dataSource = 'Information Technology Command Media';

const pathname = entry => new URL(entry.request.url).pathname;
const parseJson = text => {
    try { return JSON.parse(text || ''); } catch { return null; }
};

const responseCalls = entries.filter(entry =>
    entry.request.method === 'POST' &&
    pathname(entry) === '/genai-backend-api/responses' &&
    entry.response.status === 200
);
assert.ok(responseCalls.length > 0, 'No successful BCAI Responses calls found.');

const sourceCalls = responseCalls.filter(entry => {
    const payload = parseJson(entry.request.postData?.text);
    return payload?.bcai_options?.data_sources?.includes(dataSource);
});
assert.ok(sourceCalls.length > 0, `No successful call used ${dataSource}.`);

for (const entry of sourceCalls) {
    const payload = parseJson(entry.request.postData?.text);
    assert.deepEqual(Object.keys(payload), ['bcai_options', 'model', 'input', 'stream']);
    assert.deepEqual(payload.bcai_options.data_sources, [dataSource]);
    assert.equal(payload.bcai_options.request_source, 'BCAI');
    assert.equal(payload.bcai_options.database_options.save_to_database, false);
    assert.equal(payload.stream, true);
    assert.equal('reasoning_effort' in payload, false);
    assert.ok(payload.input.every(item => item.type === 'message'));
}

const sourcesEntry = entries.find(entry => pathname(entry) === '/bcai-security-api/rags-with-models');
const sources = parseJson(sourcesEntry?.response.content?.text);
const source = Array.isArray(sources) ? sources.find(item => item?.name === dataSource) : null;
assert.ok(source, `Data source metadata missing for ${dataSource}.`);
assert.ok(Array.isArray(source.available_models) && source.available_models.length > 0, 'No compatible models returned.');

const authorizationEntry = entries.find(entry => pathname(entry) === '/bcai-security-api/authorized');
const authorization = parseJson(authorizationEntry?.response.content?.text);
assert.equal(String(authorization?.is_authorized).toLowerCase(), 'true');

const tokenEntry = entries.find(entry => pathname(entry) === '/bcai-token-counter-api/count-tokens');
const tokenRequest = parseJson(tokenEntry?.request.postData?.text);
const tokenResponse = parseJson(tokenEntry?.response.content?.text);
assert.deepEqual(Object.keys(tokenRequest || {}), ['input', 'model']);
assert.ok(Number.isFinite(Number(tokenResponse?.token_count)));

const eventTypes = new Set();
for (const entry of sourceCalls) {
    for (const line of (entry.response.content?.text || '').split(/\r?\n/)) {
        const event = parseJson(line);
        if (event?.type) eventTypes.add(event.type);
    }
}
assert.ok(eventTypes.has('response.output_text.delta'), 'Output delta events missing.');
assert.ok(eventTypes.has('response.output_item.done'), 'Completed output item event missing.');
assert.ok(eventTypes.has('response.completed'), 'Terminal completion event missing.');

console.log(JSON.stringify({
    har: path.basename(harPath),
    successfulResponsesCalls: responseCalls.length,
    matchingDataSourceCalls: sourceCalls.length,
    compatibleModels: source.available_models.length,
    preferredModel: source.preferred_model,
    verifiedEvents: [...eventTypes].filter(type => [
        'response.output_text.delta',
        'response.output_item.done',
        'response.completed'
    ].includes(type))
}, null, 2));
