const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
const request = (id, status = 'PENDING') => ({
    id, status, category: 'BI_SPORADIC', estudio: 'TEST', pais: 'General / Todos',
    email: 'test@example.invalid', createdAt: '2026-10-15T12:00:00Z'
});

function setup(storage = new Map()) {
    const notices = [];
    const controls = new Map();
    const remote = new Map();
    const io = { failWrites: false, noConfirmation: false, writes: [], read: null, write: null };
    const client = { from: () => ({
        select: () => ({ order: async () => io.read ? io.read() : ({
            data: [...remote.values()].map(payload => ({
                id: payload.id, payload: clone(payload), created_at: payload.createdAt,
                updated_at: '2026-10-15T12:01:00Z'
            })), error: null
        }) }),
        upsert: records => ({ select: async () => {
            const sent = clone(records);
            io.writes.push(sent);
            if (io.write) await io.write(sent);
            if (io.failWrites) return { data: null, error: { message: 'Offline' } };
            if (io.noConfirmation) return { data: [], error: null };
            sent.forEach(row => remote.set(row.id, row.payload));
            return { data: sent.map(row => ({ id: row.id })), error: null };
        } }),
        delete: () => ({ eq: async (_, id) => { remote.delete(id); return { error: null }; } })
    }) };
    const context = vm.createContext({
        console: { error() {}, warn() {}, log() {} },
        document: { addEventListener() {}, getElementById: id => controls.get(id) || null },
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        confirm: () => true, URL, setTimeout, clearTimeout
    });
    vm.runInContext(source + `
        getSupabaseClient = () => testClient;
        showToast = (text, type) => testNotices.push({ text, type });
        renderAll = () => renderPendingRequestSync();
        renderNovedades = renderVacacionesAdminTable = renderImportantLinks = checkTodayNovelty = () => {};
        closeIngestModal = () => {};
        globalThis.api = {
            fetchCloudData, syncCloudData, handleIngestSubmit, deleteRequest,
            loadFromStorage, loadPendingRequestWrites,
            get state() { return state; },
            get pending() { return pendingRequestWrites; }
        };
    `, Object.assign(context, { testClient: client, testNotices: notices }));
    const values = {
        'ing-id': 'NEW', 'ing-email': 'test@example.invalid', 'ing-cat': 'BI_SPORADIC',
        'ing-estudio': 'TEST', 'ing-pais': 'General / Todos', 'ing-status': 'PENDING',
        'ing-detalle': 'Local regression test', 'ing-requested-date': '2026-10-15', 'ing-delivered-date': ''
    };
    Object.entries(values).forEach(([id, value]) => controls.set(id, { value }));
    const button = { disabled: false };
    const event = { preventDefault() {}, target: { querySelector: () => button } };
    return { api: context.api, io, remote, storage, notices, controls, button, event };
}

test('failed manual save warns and survives subsequent cloud reads and reloads', async () => {
    const env = setup();
    env.io.failWrites = true;
    await env.api.handleIngestSubmit(env.event);
    assert.equal(env.notices.at(-1).type, 'warning');
    assert.equal(env.api.pending.size, 1);
    await env.api.fetchCloudData();
    assert.equal(env.api.state.requests[0].id, 'NEW');
    const reloaded = setup(env.storage);
    reloaded.io.failWrites = true;
    reloaded.api.loadFromStorage();
    reloaded.api.loadPendingRequestWrites();
    await reloaded.api.fetchCloudData();
    assert.equal(reloaded.api.pending.size, 1);
    assert.equal(reloaded.api.state.requests[0].id, 'NEW');
});

test('recovery retries once, confirms the row and clears the persisted queue', async () => {
    const env = setup();
    env.io.failWrites = true;
    await env.api.handleIngestSubmit(env.event);
    env.io.failWrites = false;
    await env.api.fetchCloudData();
    assert.equal(env.remote.size, 1);
    assert.equal(env.api.pending.size, 0);
    assert.equal(env.storage.get('dn_portal_pending_request_writes_v1'), '[]');
    const writeCount = env.io.writes.length;
    await env.api.fetchCloudData();
    assert.equal(env.io.writes.length, writeCount);
});

test('manual save waits for confirmation and prevents double submissions', async () => {
    const env = setup();
    const gate = deferred();
    env.io.write = () => gate.promise;
    const submitting = env.api.handleIngestSubmit(env.event);
    await tick();
    assert.equal(env.button.disabled, true);
    assert.equal(env.notices.length, 0);
    await env.api.handleIngestSubmit(env.event);
    assert.equal(env.io.writes.length, 1);
    gate.resolve();
    await submitting;
    assert.equal(env.notices.at(-1).type, 'success');
    assert.equal(env.button.disabled, false);
});

test('an unconfirmed response keeps the request pending', async () => {
    const env = setup();
    env.io.noConfirmation = true;
    await env.api.handleIngestSubmit(env.event);
    assert.equal(env.api.pending.size, 1);
    assert.equal(env.notices.at(-1).type, 'warning');
});

test('a stale read cannot erase a newly confirmed request', async () => {
    const env = setup();
    const gate = deferred();
    env.io.read = () => gate.promise;
    const reading = env.api.fetchCloudData();
    await tick();
    env.api.state.requests.push(request('NEW'));
    assert.equal(await env.api.syncCloudData(['NEW']), true);
    gate.resolve({ data: [], error: null });
    assert.equal(await reading, false);
    assert.equal(env.api.state.requests[0].id, 'NEW');
});

test('a pending status edit wins over an older cloud version', async () => {
    const env = setup();
    env.remote.set('EXISTING', request('EXISTING'));
    env.api.state.requests.push(request('EXISTING', 'RESOLVED'));
    env.io.failWrites = true;
    await env.api.syncCloudData(['EXISTING']);
    await env.api.fetchCloudData();
    assert.equal(env.api.state.requests[0].status, 'RESOLVED');
    env.io.failWrites = false;
    await env.api.fetchCloudData();
    assert.equal(env.remote.get('EXISTING').status, 'RESOLVED');
});

test('newer edits made during an upload are serialized and not discarded', async () => {
    const env = setup();
    const gate = deferred();
    env.io.write = () => env.io.writes.length === 1 ? gate.promise : undefined;
    env.api.state.requests.push(request('EDIT'));
    const first = env.api.syncCloudData(['EDIT']);
    env.api.state.requests[0].status = 'RESOLVED';
    const second = env.api.syncCloudData(['EDIT']);
    gate.resolve();
    await Promise.all([first, second]);
    assert.equal(env.io.writes.length, 2);
    assert.equal(env.remote.get('EDIT').status, 'RESOLVED');
    assert.equal(env.api.pending.size, 0);
});

test('obsolete cached requests are never uploaded or resurrected', async () => {
    const env = setup();
    env.api.state.requests.push(request('PREVIOUSLY-DELETED'));
    await env.api.fetchCloudData();
    assert.equal(env.api.state.requests.length, 0);
    assert.equal(env.io.writes.length, 0);
});

test('deleting while an upload is in flight does not recreate the request', async () => {
    const env = setup();
    const gate = deferred();
    env.io.write = () => gate.promise;
    env.api.state.requests.push(request('DELETE'));
    const writing = env.api.syncCloudData(['DELETE']);
    const deleting = env.api.deleteRequest('DELETE');
    gate.resolve();
    await Promise.all([writing, deleting]);
    await env.api.fetchCloudData();
    assert.equal(env.remote.size, 0);
    assert.equal(env.api.pending.size, 0);
    assert.equal(env.api.state.requests.length, 0);
});

test('read errors retain local data and missing IDs cannot report save success', async () => {
    const env = setup();
    env.api.state.requests.push(request('CACHED'));
    env.io.read = async () => ({ error: { message: 'Offline' }, data: null });
    assert.equal(await env.api.fetchCloudData(), false);
    assert.equal(env.api.state.requests[0].id, 'CACHED');
    assert.equal(await env.api.syncCloudData(['MISSING']), false);
});

test('manual ingestion does not overwrite an existing folio', async () => {
    const env = setup();
    env.api.state.requests.push(request('NEW', 'RESOLVED'));
    await env.api.handleIngestSubmit(env.event);
    assert.equal(env.api.state.requests[0].status, 'RESOLVED');
    assert.equal(env.io.writes.length, 0);
    assert.equal(env.notices.at(-1).type, 'warning');
});

test('an older response arriving last cannot replace a newer cloud response', async () => {
    const env = setup();
    const first = deferred();
    const second = deferred();
    let reads = 0;
    env.io.read = () => ++reads === 1 ? first.promise : second.promise;
    const oldRead = env.api.fetchCloudData();
    const newRead = env.api.fetchCloudData();
    await tick();
    second.resolve({ data: [{ id: 'REMOTE', payload: request('REMOTE', 'RESOLVED') }], error: null });
    assert.equal(await newRead, true);
    first.resolve({ data: [{ id: 'REMOTE', payload: request('REMOTE') }], error: null });
    assert.equal(await oldRead, false);
    assert.equal(env.api.state.requests[0].status, 'RESOLVED');
});

test('storage quota failures warn users to keep the page open', async () => {
    const env = setup();
    const save = env.storage.set.bind(env.storage);
    env.storage.set = (key, value) => {
        if (key === 'dn_portal_pending_request_writes_v1') throw new Error('Quota exceeded');
        return save(key, value);
    };
    env.io.failWrites = true;
    await env.api.handleIngestSubmit(env.event);
    assert.equal(env.notices.at(-1).type, 'warning');
    assert.match(env.notices.at(-1).text, /Mantén esta página abierta/);
    assert.equal(env.api.pending.size, 1);
    await env.api.fetchCloudData();
    assert.equal(env.api.state.requests[0].id, 'NEW');
});
