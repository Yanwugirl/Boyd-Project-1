'use strict';
const http = require('node:http');
const { test } = require('node:test');
const { once } = require('node:events');
const assert = require('node:assert/strict');
const { createInterpreter } = require('../lib/interpreter.cjs');

test('the Ollama adapter rewrites in the player’s own language and checks model availability', async t => {
  let request, outputs = [];
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/tags') { res.end(JSON.stringify({ models: [{ name: 'test-local' }] })); return; }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    request = JSON.parse(Buffer.concat(chunks));
    res.end(JSON.stringify({ message: { content: outputs.shift() ?? 'not JSON' } }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => new Promise(r => server.close(r)));
  const interpreter = createInterpreter({ mode: 'ollama', model: 'test-local', url: `http://127.0.0.1:${server.address().port}` });
  assert.equal((await interpreter.status()).ready, true);

  // English stays English: the last user message carries x, the system prompt is the English one.
  outputs = ['{"y":"I have been waiting by the window all day.","tone":"warm"}'];
  const result = await interpreter.interpret('I am here.');
  assert.equal(request.model, 'test-local'); assert.equal(request.stream, false);
  assert.ok(request.messages.at(-1).content.includes(JSON.stringify('I am here.')));
  assert.match(request.messages[0].content, /English only/);
  assert.equal(result.y, 'I have been waiting by the window all day.'); assert.equal(result.engine, 'ollama');

  // Only punctuation added, or the wrong language: retry once, then a calm line in the same language.
  outputs = ['{"y":"什么鬼？","tone":"curious"}', '{"y":"这真是个惊喜。","tone":"warm"}'];
  assert.equal((await interpreter.interpret('什么鬼')).y, '这真是个惊喜。');
  outputs = ['{"y":"What the hell?","tone":"curious"}', '{"y":"What the hell!","tone":"curious"}'];
  assert.doesNotMatch((await interpreter.interpret('What the hell')).y, /hell|[\u3400-\u9fff]/);
  outputs = ['{"y":"I love it.","tone":"warm"}', 'not JSON'];
  assert.match((await interpreter.interpret('我讨厌这个')).y, /^[^A-Za-z]+$/);

  // Other languages keep the original single request and its errors.
  outputs = ['not JSON']; await assert.rejects(interpreter.interpret('¿Qué tal, amiga?'), /JSON/);
  outputs = ['{"y":""}']; await assert.rejects(interpreter.interpret('¿Qué tal, amiga?'));
  outputs = [JSON.stringify({ y: 'x'.repeat(481) })]; await assert.rejects(interpreter.interpret('¿Qué tal, amiga?'));
});

test('rehearsal is explicitly scripted, and never requires Ollama', async () => {
  const interpreter = createInterpreter({ mode: 'scripted' });
  assert.deepEqual(await interpreter.status(), { mode: 'scripted', model: null, ready: true });
  assert.equal((await interpreter.interpret('Are you there?', 'hello')).engine, 'scripted');
  assert.equal((await interpreter.interpret('<script>alert(1)</script>')).y, '<script>alert(1)</script>');
});
