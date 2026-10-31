'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const { once } = require('node:events');
const { createGame } = require('../server.cjs');

function waitState(client, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { client.off('state', check); reject(new Error('State timed out')); }, 5000);
    const check = state => { if (predicate(state)) { clearTimeout(timeout); client.off('state', check); resolve(state); } };
    client.on('state', check);
  });
}
async function send(client, event, payload) {
  return new Promise((resolve, reject) => client.timeout(5000).emit(event, payload, (err, result) => err ? reject(err) : resolve(result)));
}
async function start(t, extra = {}) {
  const game = createGame({ mode: 'scripted', ...extra });
  game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
  const url = `http://127.0.0.1:${game.server.address().port}`;
  const clients = [];
  t.after(async () => { clients.forEach(c => c.disconnect()); await game.close(); });
  async function client(token, room = 'two-rooms') {
    const c = io(url, { forceNew: true, transports: ['websocket'], autoConnect: false });
    clients.push(c); c.connect(); await once(c, 'connect');
    const joined = await send(c, 'join', { room, token });
    return { c, joined };
  }
  return { game, url, client };
}

test('two real sockets receive their own x and only the other y; rooms and transcripts remain isolated', async t => {
  const { client, url } = await start(t);
  const a = await client('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  assert.equal(a.joined.role, 'human');
  const b = await client('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  assert.equal(b.joined.role, 'robot');
  const outsider = await client('cccccccc-cccc-cccc-cccc-cccccccccccc', 'another-room');
  assert.equal((await send(outsider.c, 'message:send', { phraseId: 'hello' })).ok, false);
  const sentState = waitState(a.c, s => s.messages.length === 1);
  const receivedState = waitState(b.c, s => s.messages.length === 1);
  assert.equal((await send(a.c, 'message:send', { phraseId: 'hello' })).ok, true);
  const [s1, s2] = await Promise.all([sentState, receivedState]);
  assert.deepEqual(s1.messages.map(m => [m.kind, m.text]), [['sent', 'Are you there?']]);
  assert.deepEqual(s2.messages.map(m => [m.kind, m.text]), [['received', 'Is there a light on at your end?']]);
  assert.equal(JSON.stringify(s2).includes('Are you there?'), false);
  assert.equal(JSON.stringify(s1).includes('light on at your end'), false);
  const third = await client('dddddddd-dddd-dddd-dddd-dddddddddddd');
  assert.equal(third.joined.ok, false);
  assert.equal((await fetch(`${url}/server.cjs`)).status, 404);
  assert.equal((await fetch(`${url}/prompts/abstract.txt`)).status, 404);
  assert.equal((await fetch(`${url}/health`)).status, 200);
});

test('a player reconnects to the same seat and history, while the other cannot send alone', async t => {
  const { client } = await start(t);
  const token = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const a = await client(token); const b = await client('ffffffff-ffff-ffff-ffff-ffffffffffff');
  await send(a.c, 'message:send', { phraseId: 'time' });
  const disconnected = waitState(b.c, s => !s.paired);
  a.c.disconnect(); await disconnected;
  assert.equal((await send(b.c, 'message:send', { phraseId: 'here' })).ok, false);
  const paired = waitState(b.c, s => s.paired);
  const again = await client(token); assert.equal(again.joined.role, 'human'); await paired;
  const liveSeat = await client(token); assert.equal(liveSeat.joined.ok, false);
});

test('both people contribute and choose the ending; one player cannot complete it alone', async t => {
  let now = Date.now();
  const { client } = await start(t, { clock: () => now });
  const { c: a } = await client('11111111-1111-1111-1111-111111111111');
  const { c: b } = await client('22222222-2222-2222-2222-222222222222');
  assert.equal((await send(a, 'ready', true)).ok, false);
  for (const c of [a, b, a, b]) { now += 600; assert.equal((await send(c, 'message:send', { phraseId: 'here' })).ok, true); }
  const waiting = waitState(b, s => s.phase === 'act1' && s.players[0].ready);
  assert.equal((await send(a, 'ready', true)).ok, true); await waiting;
  const endA = waitState(a, s => s.phase === 'act1-ended'); const endB = waitState(b, s => s.phase === 'act1-ended');
  assert.equal((await send(b, 'ready', true)).ok, true); await Promise.all([endA, endB]);
  assert.equal((await send(a, 'message:send', { phraseId: 'here' })).ok, false);
});

test('failed model requests deliver no fake messages, release the room, and permit retry', async t => {
  let shouldFail = true, now = Date.now();
  const interpreter = { mode: 'ollama', status: async () => ({ ready: true }), interpret: async () => {
    if (shouldFail) throw new Error('fetch failed');
    return { y: 'A small light.', tone: 'quiet', engine: 'ollama' };
  } };
  const { client, game } = await start(t, { interpreter, clock: () => now });
  const { c: a } = await client('33333333-3333-3333-3333-333333333333');
  await client('44444444-4444-4444-4444-444444444444');
  assert.equal((await send(a, 'message:send', { phraseId: 'hello' })).ok, false);
  assert.equal(game.rooms.get('two-rooms').messages.length, 0); assert.equal(game.rooms.get('two-rooms').busy, false);
  shouldFail = false; now += 600;
  assert.equal((await send(a, 'message:send', { text: 'I need space.' })).ok, true);
  assert.equal(game.rooms.get('two-rooms').messages[0].x, 'I need space.');
});

test('invalid and overlong input is rejected before inference; selected phrases are server owned', async t => {
  const { client } = await start(t);
  const { c: a } = await client('55555555-5555-5555-5555-555555555555');
  await client('66666666-6666-6666-6666-666666666666');
  for (const input of [{ text: '' }, { text: 'a'.repeat(281) }, { text: {} }, { phraseId: 'invented' }, null]) {
    assert.equal((await send(a, 'message:send', input)).ok, false);
  }
  assert.equal((await send(a, 'message:send', { phraseId: 'hello', text: 'injected other text' })).ok, true);
});
