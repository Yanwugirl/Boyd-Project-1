'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { io } = require('socket.io-client');
const { createGame } = require('../server.cjs');
const { layout } = require('../lib/act2.cjs');
const emit = (client, event, data) => new Promise((resolve, reject) => client.timeout(5000).emit(event, data, (error, result) => error ? reject(error) : resolve(result)));

test('two real clients complete all three acts with the Filter Room, exact final words, reconnect, and mutual closure', async t => {
  let now = Date.now();
  let modelCalls = 0;
  const interpreter = { mode: 'ollama', model: 'counting-fixture', async interpret(text) { modelCalls++; return { y: 'Interpreted: ' + text, tone: 'quiet', engine: 'test-adapter' }; }, async status() { return { ready: true, mode: 'ollama' }; } };
  const game = createGame({ interpreter, clock: () => now });
  game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
  const base = 'http://127.0.0.1:' + game.server.address().port;
  const room = await fetch(base + '/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'ollama', model: 'counting-fixture' }) }).then(response => response.json());
  const clients = [];
  t.after(async () => { for (const client of clients) client.disconnect(); await game.close(); });
  async function join(player) {
    const client = io(base, { transports: ['websocket'], autoConnect: false }); clients.push(client);
    client.connect(); await once(client, 'connect');
    assert.equal((await emit(client, 'join', { room: room.room, player, token: 'persisted-token-for-player-' + player, requireExisting: true })).ok, true);
    return client;
  }
  const human = await join(1); let robot = await join(2);
  const active = game.rooms.get(room.room);
  assert.equal((await emit(human, 'act2:action', { type: 'arrive' })).ok, false);
  for (const client of [human, robot, human, robot]) { now += 600; assert.equal((await emit(client, 'message:send', { text: 'I need time to choose.' })).ok, true); }
  const statePromise = once(human, 'state');
  await emit(human, 'ready', true); const [beforeReveal] = await statePromise;
  assert.deepEqual(beforeReveal.reveal, []);
  await emit(robot, 'ready', true);
  const transition = active.journey.transition;
  const loaded = { act: 'act2', transitionId: transition.id };
  await emit(human, 'scene:loaded', loaded); await emit(robot, 'scene:loaded', loaded);
  assert.equal(active.phase, 'act2'); now += 1500; game.advanceScenes();
  await emit(human, 'act2:action', { type: 'arrive' });
  assert.equal(active.act2.step, 'arrival');
  await emit(robot, 'act2:action', { type: 'arrive' });
  assert.equal(active.act2.step, 'round');
  assert.equal(active.act2.rounds.length, 3, 'Rounds are built from this room’s real Act I messages');
  assert.equal(active.act2.rounds[0].messageId, active.messages.find(m => m.id === active.act2.rounds[0].messageId)?.id);

  const clientOf = role => (role === 'human' ? human : robot);
  async function point(client, target) {
    now += 100; client.emit('scene:move', target);
    await emit(client, 'scene:loaded', loaded); // an ordering barrier: the move has arrived
  }
  function tick(duration) {
    for (let passed = 0; passed < duration; passed += 50) { now += 50; game.advanceScenes(); }
  }
  async function solveRound() {
    const round = active.act2.rounds[active.act2.round];
    const writer = clientOf(round.writer), reader = clientOf(round.reader);
    const truth = layout.terminals[round.trueIndex];
    await point(writer, { x: .5, y: .9 }); await point(reader, { x: .5, y: .88 }); tick(100);
    await point(writer, truth); tick(2600);
    assert.equal(active.act2.pinned, round.trueIndex);
    await point(reader, truth); tick(1500);
    assert.equal(active.act2.step, 'restored');
  }
  await solveRound();
  assert.equal(active.act2.restored.length, 1);
  const pause = once(human, 'state'); robot.disconnect(); await pause;
  now += 2000; game.advanceScenes();
  robot = await join(2);
  assert.equal(active.act2.step, 'restored');
  assert.equal(active.messages.length, 4);
  await emit(human, 'act2:action', { type: 'next' });
  assert.equal(active.act2.round, 0);
  await emit(robot, 'act2:action', { type: 'next' });
  assert.equal(active.act2.round, 1);
  assert.equal((await emit(human, 'act2:action', { type: 'continue', value: true })).ok, false);
  await solveRound();
  await emit(human, 'act2:action', { type: 'next' }); await emit(robot, 'act2:action', { type: 'next' });
  await solveRound();
  await emit(human, 'act2:action', { type: 'next' }); await emit(robot, 'act2:action', { type: 'next' });
  assert.equal(active.act2.step, 'join');
  const ring = { x: layout.joinRing.x, y: layout.joinRing.y };
  await point(human, ring); tick(2000);
  assert.equal(active.act2.step, 'join');
  await point(robot, ring); tick(2000);
  assert.equal(active.act2.step, 'threshold');
  const revealState = once(human, 'state');
  await emit(human, 'act2:action', { type: 'continue', value: true });
  const [revealed] = await revealState;
  assert.equal(revealed.reveal.length, 4);
  assert.equal(active.phase, 'act2');
  await emit(human, 'act2:action', { type: 'continue', value: false });
  await emit(robot, 'act2:action', { type: 'continue', value: true });
  assert.equal(active.phase, 'act2');
  await emit(human, 'act2:action', { type: 'continue', value: true });
  assert.equal(active.phase, 'act2-ended');
  assert.equal(active.journey.handoff.key, 'joined');
  assert.equal(active.journey.handoff.shell, 'closed');
  assert.equal(active.journey.handoff.recoveredMessageIds.length, 3);

  const finalData = { act: 'act3', transitionId: active.journey.transition.id };
  await emit(human, 'scene:loaded', finalData); assert.equal(active.phase, 'act2-ended');
  await emit(robot, 'scene:loaded', finalData);
  assert.equal(active.phase, 'act3');
  assert.deepEqual(active.journey.completed, ['act1', 'act2']);
  assert.equal(active.messages.length, 4);
  assert.equal(modelCalls, 4);
  now += 2000;
  assert.equal((await emit(robot, 'act3:action', { type: 'accept-key' })).ok, false);
  assert.equal((await emit(human, 'act3:send', { clientId: 'initial-direct-message-123', text: 'hello' })).ok, false);
  await emit(robot, 'act3:action', { type: 'request-key' });
  await emit(human, 'act3:action', { type: 'offer-key', value: true });
  await emit(robot, 'act3:action', { type: 'more-time' });
  assert.equal(active.act3.step, 'sealed');
  await emit(human, 'act3:action', { type: 'offer-key', value: true });
  await emit(robot, 'act3:action', { type: 'accept-key' });
  now += 2000;
  const exactText = ' 这是我真正想说的。\nThese words arrive unchanged. 🌱 ';
  const outbound = { clientId: 'final-human-message-123456', text: exactText };
  const twoMessages = await Promise.all([
    emit(human, 'act3:send', outbound),
    emit(robot, 'act3:send', { clientId: 'final-robot-message-123456', text: '我在这里。I am here.' })
  ]);
  assert.equal(twoMessages.every(result => result.ok), true);
  assert.equal(active.act3.messages.length, 2);
  assert.equal(active.act3.messages.find(message => message.from === 'human').text, exactText);
  const duplicate = await emit(human, 'act3:send', outbound);
  assert.equal(duplicate.id, twoMessages[0].id);
  assert.equal(active.act3.messages.length, 2);
  assert.equal(modelCalls, 4, 'Act III never calls the selected Act I interpreter');
  const receivedState = once(human, 'state');
  await emit(robot, 'act3:action', { type: 'finish', value: true });
  const [directState] = await receivedState;
  assert.equal(directState.act3.messages.find(message => message.from === 'human').text, exactText);
  const disconnected = once(human, 'state'); robot.disconnect(); await disconnected;
  assert.deepEqual(active.act3.endReady, { human: false, robot: false });
  assert.equal((await emit(human, 'act3:send', { clientId: 'offline-direct-message-123', text: 'keep my draft' })).ok, false);
  robot = await join(2);
  assert.equal(active.act3.step, 'conversation'); assert.equal(active.act3.messages.length, 2);
  await emit(human, 'act3:action', { type: 'finish', value: true });
  now += 250;
  await emit(robot, 'act3:send', { clientId: 'another-direct-message-123', text: 'One more thought.' });
  assert.deepEqual(active.act3.endReady, { human: false, robot: false });
  await emit(human, 'act3:action', { type: 'finish', value: true });
  await emit(robot, 'act3:action', { type: 'finish', value: true });
  assert.equal(active.phase, 'complete');
  assert.deepEqual(active.journey.completed, ['act1', 'act2', 'act3']);
  assert.equal(active.act3.messages.length, 3);
  assert.equal(modelCalls, 4);
});
