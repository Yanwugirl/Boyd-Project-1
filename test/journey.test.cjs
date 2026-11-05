'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { io } = require('socket.io-client');
const { createGame } = require('../server.cjs');
const { beginTransition } = require('../lib/journey.cjs');
const emit = (client, event, data) => new Promise((resolve, reject) => client.timeout(5000).emit(event, data, (e, r) => e ? reject(e) : resolve(r)));
const stateWhen = (client, predicate) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { client.off('state', listener); reject(new Error('Room state timed out')); }, 5000);
  function listener(state) { if (predicate(state)) { clearTimeout(timer); client.off('state', listener); resolve(state); } }
  client.on('state', listener);
});
async function start(t) {
  let now = Date.now();
  const game = createGame({ mode: 'direct', clock: () => now });
  game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
  const url = 'http://127.0.0.1:' + game.server.address().port, clients = [];
  t.after(async () => { clients.forEach(c => c.disconnect()); await game.close(); });
  const room = await fetch(url + '/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'direct' }) }).then(r => r.json());
  async function join(token, player, id = room.room) {
    const c = io(url, { transports: ['websocket'], autoConnect: false }); clients.push(c);
    c.connect(); await once(c, 'connect');
    const result = await emit(c, 'join', { room: id, token, player, requireExisting: true });
    return { c, result };
  }
  return { game, url, room, join, tick: () => { now += 1500; } };
}
test('both scene loaders share one handoff; stage movement and reconnect preserve the room and identity', async t => {
  const { game, room, join, tick } = await start(t);
  const a = (await join('11111111-1111-1111-1111-111111111111', 1)).c;
  const bToken = '22222222-2222-2222-2222-222222222222';
  let b = (await join(bToken, 2)).c;
  for (const c of [a, b, a, b]) { tick(); assert.equal((await emit(c, 'message:send', { text: 'A real contribution.' })).ok, true); }
  await emit(a, 'ready', true); await emit(b, 'ready', true);
  const active = game.rooms.get(room.room), transition = active.journey.transition;
  assert.equal(active.phase, 'act1-ended'); assert.equal(active.journey.act, 'act1');
  assert.equal((await emit(a, 'scene:loaded', { act: 'act3', transitionId: transition.id })).ok, false);
  const data = { act: 'act2', transitionId: transition.id };
  await emit(a, 'scene:loaded', data);
  assert.equal(active.phase, 'act1-ended'); assert.equal(transition.loaded.robot, false);
  const both = [stateWhen(a, s => s.phase === 'act2'), stateWhen(b, s => s.phase === 'act2')];
  await emit(b, 'scene:loaded', data);
  const entered = await Promise.all(both);
  assert.equal(entered[0].room, entered[1].room); assert.equal(entered[0].journey.transition.startsAt, entered[1].journey.transition.startsAt);
  assert.deepEqual(active.journey.completed, ['act1']);
  assert.equal(beginTransition(active), false, 'Act III cannot be entered before the game and mutual consent');
  const before = { ...active.journey.stage.positions.human };
  a.emit('scene:move', { x: .9, y: .9 }); await emit(a, 'scene:loaded', data);
  assert.deepEqual(active.journey.stage.positions.human, before, 'Movement waits until the shared start time');
  tick();
  const updates = [once(a, 'stage:state'), once(b, 'stage:state')];
  a.emit('scene:move', { x: -10, y: 10 });
  const [own, peer] = await Promise.all(updates);
  assert.deepEqual(own[0].positions.human, { x: .05, y: .88 });
  assert.deepEqual(peer[0].positions, own[0].positions);
  const paused = stateWhen(a, s => !s.paired); b.disconnect(); await paused;
  tick(); a.emit('scene:move', { x: .5, y: .5 }); await emit(a, 'scene:loaded', data);
  assert.deepEqual(active.journey.stage.positions.human, { x: .05, y: .88 });
  const resumed = stateWhen(a, s => s.paired && s.phase === 'act2');
  const again = await join(bToken, 2); b = again.c; await resumed;
  assert.equal(again.result.role, 'robot'); assert.equal(active.messages.length, 4);
  assert.deepEqual(active.journey.stage.positions.human, { x: .05, y: .88 });
});
test('room codes join existing two-person rooms and do not silently create misspelled rooms', async t => {
  const { game, room, join } = await start(t);
  const a = await join('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1);
  const b = await join('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', undefined);
  assert.equal(a.result.role, 'human'); assert.equal(b.result.role, 'robot');
  const third = await join('cccccccc-cccc-cccc-cccc-cccccccccccc', undefined);
  assert.equal(third.result.ok, false);
  const wrong = await join('dddddddd-dddd-dddd-dddd-dddddddddddd', undefined, 'unknown-code');
  assert.equal(wrong.result.ok, false); assert.equal(game.rooms.has('unknown-code'), false);
  assert.equal(game.rooms.get(room.room).players.length, 2);
});
