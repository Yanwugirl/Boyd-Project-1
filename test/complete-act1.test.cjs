'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { io } = require('socket.io-client');
const { createGame } = require('../server.cjs');
const emit = (c, event, value) => new Promise((resolve, reject) => c.timeout(5000).emit(event, value, (err, result) => err ? reject(err) : resolve(result)));

test('complete setup creates a room, preserves explicit player order, and protects the original/transformed record', async t => {
  const game = createGame({ mode: 'direct' }); game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
  const url = `http://127.0.0.1:${game.server.address().port}`;
  const a = io(url, { transports: ['websocket'], autoConnect: false }), b = io(url, { transports: ['websocket'], autoConnect: false });
  t.after(async () => { a.disconnect(); b.disconnect(); await game.close(); });
  const result = await fetch(`${url}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'direct', model: 'llama3.2:1b' }) });
  assert.equal(result.status, 201); const room = await result.json();
  assert.match(room.player1, /player1\.html/); assert.match(room.player2, /player2\.html/); assert.match(room.split, /dual\.html/);
  for (const file of [room.player1, room.player2, room.split]) assert.equal((await fetch(url + file)).status, 200);
  a.connect(); b.connect(); await Promise.all([once(a, 'connect'), once(b, 'connect')]);
  assert.equal((await emit(b, 'join', { room: room.room, player: 2, token: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' })).role, 'robot');
  assert.equal((await emit(a, 'join', { room: room.room, player: 1, token: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' })).role, 'human');
  assert.equal((await emit(a, 'message:send', { text: 'A real message from player one.' })).ok, true);
  assert.equal((await fetch(`${url}/api/sessions/${room.room}/inspect`)).status, 403);
  assert.equal((await fetch(`${url}/api/sessions/${room.room}/inspect`, { headers: { 'x-act1-host-token': 'wrong-token' } })).status, 403);
  const audit = await fetch(`${url}/api/sessions/${room.room}/inspect`, { headers: { 'x-act1-host-token': room.hostToken } }).then(r => r.json());
  assert.equal(audit.players[0].connected, true); assert.equal(audit.players[1].connected, true);
  assert.equal(audit.messages[0].x, 'A real message from player one.'); assert.equal(audit.messages[0].engine, 'direct');
});

test('setup model probe and an Ollama room call the selected adapter and reject cross-origin setup changes', async t => {
  const fixture = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'fixture:1b' }] }));
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks)); assert.equal(body.model, 'fixture:1b');
    return res.end(JSON.stringify({ message: { content: JSON.stringify({ y: 'A window needs a little space.', tone: 'quiet' }) } }));
  });
  fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening');
  const game = createGame({ mode: 'direct', ollamaUrl: `http://127.0.0.1:${fixture.address().port}` });
  game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
  const url = `http://127.0.0.1:${game.server.address().port}`;
  t.after(async () => { await game.close(); await new Promise(r => fixture.close(r)); });
  const setup = await fetch(`${url}/api/setup?model=fixture:1b`).then(r => r.json()); assert.equal(setup.ollama.ready, true);
  const probe = await fetch(`${url}/api/model-test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'I need space.', model: 'fixture:1b' }) }).then(r => r.json());
  assert.equal(probe.ok, true); assert.equal(probe.engine, 'ollama'); assert.equal(probe.y, 'A window needs a little space.');
  const blocked = await fetch(`${url}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://another.example' }, body: JSON.stringify({ mode: 'direct' }) });
  assert.equal(blocked.status, 403);
  const invalid = await fetch(`${url}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'unknown' }) });
  assert.equal(invalid.status, 400);
});
