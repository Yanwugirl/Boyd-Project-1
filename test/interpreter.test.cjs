'use strict';
const http = require('node:http');
const { test } = require('node:test');
const { once } = require('node:events');
const assert = require('node:assert/strict');
const { createInterpreter } = require('../lib/interpreter.cjs');

test('the Ollama adapter sends x in a user message, reads message.content as y, and checks model availability', async t => {
  let request, output = '{"y":"A light at the window.","tone":"warm"}';
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/tags') { res.end(JSON.stringify({ models: [{ name: 'test-local' }] })); return; }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    request = JSON.parse(Buffer.concat(chunks));
    res.end(JSON.stringify({ message: { content: output } }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => new Promise(r => server.close(r)));
  const interpreter = createInterpreter({ mode: 'ollama', model: 'test-local', url: `http://127.0.0.1:${server.address().port}` });
  assert.equal((await interpreter.status()).ready, true);
  const result = await interpreter.interpret('I am here.');
  assert.equal(request.model, 'test-local'); assert.equal(request.stream, false);
  assert.ok(request.messages[1].content.includes(JSON.stringify('I am here.')));
  assert.match(request.messages[1].content, /Do not reply/);
  assert.match(request.messages[0].content, /abstract interpretation/);
  assert.equal(result.y, 'A light at the window.'); assert.equal(result.engine, 'ollama');
  output = 'not JSON'; await assert.rejects(interpreter.interpret('Hi'), /JSON/);
  output = '{"y":""}'; await assert.rejects(interpreter.interpret('Hi'), /empty/);
  output = '{"y":"the rewritten line"}'; await assert.rejects(interpreter.interpret('Hi')); 
  output = JSON.stringify({ y: 'x'.repeat(481) }); await assert.rejects(interpreter.interpret('Hi'), /overlong/);
});

test('rehearsal is explicitly scripted, and never requires Ollama', async () => {
  const interpreter = createInterpreter({ mode: 'scripted' });
  assert.deepEqual(await interpreter.status(), { mode: 'scripted', model: null, ready: true });
  assert.equal((await interpreter.interpret('Are you there?', 'hello')).engine, 'scripted');
  assert.equal((await interpreter.interpret('<script>alert(1)</script>')).y, '<script>alert(1)</script>');
});
