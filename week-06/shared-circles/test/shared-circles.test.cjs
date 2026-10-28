const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { io } = require('socket.io-client');

function waitFor(emitter, event) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for ' + event)), 6000);
    emitter.once(event, data => { clearTimeout(timeout); resolve(data); });
  });
}
test('real server synchronises additions, topmost deletion, late joins and reconnects over WebSocket', async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: require('node:path').join(__dirname, '..'),
    env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  const clients = [];
  try {
    const port = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Server did not start')), 6000);
      child.stdout.on('data', data => {
        output += data;
        const hit = /Listening on port (\d+)/.exec(output);
        if (hit) { clearTimeout(timer); resolve(hit[1]); }
      });
      child.on('error', reject);
      child.stderr.on('data', data => process.stderr.write(data));
    });
    const base = 'http://127.0.0.1:' + port;
    async function connect() {
      const socket = io(base, { transports: ['websocket'], autoConnect: false });
      clients.push(socket);
      const state = waitFor(socket, 'circles');
      socket.connect();
      const initial = await state;
      assert.equal(socket.io.engine.transport.name, 'websocket');
      return { socket, initial };
    }
    for (const path of ['/', '/sketch.js', '/socket.io/socket.io.js', '/stage-1/', '/practice/', '/practice/examples.json']) {
      assert.equal((await fetch(base + path)).status, 200, path);
    }
    const a = await connect(); const b = await connect();
    assert.deepEqual(a.initial, []); assert.deepEqual(b.initial, []);
    let aw = waitFor(a.socket, 'circles'); let bw = waitFor(b.socket, 'circles');
    a.socket.emit('click', { x: 120, y: 80 });
    const first = await aw;
    assert.deepEqual(await bw, first); assert.equal(first.length, 1);
    aw = waitFor(a.socket, 'circles'); bw = waitFor(b.socket, 'circles');
    a.socket.emit('click', { x: 175, y: 80 });
    assert.equal((await aw).length, 2); await bw;
    aw = waitFor(a.socket, 'circles'); bw = waitFor(b.socket, 'circles');
    b.socket.emit('click', { x: 148, y: 80 });
    assert.deepEqual(await aw, first); assert.deepEqual(await bw, first);
    const c = await connect(); assert.deepEqual(c.initial, first);
    c.socket.disconnect();
    const reconnectState = waitFor(c.socket, 'circles'); c.socket.connect();
    assert.deepEqual(await reconnectState, first);
    aw = waitFor(a.socket, 'circles'); bw = waitFor(b.socket, 'circles');
    b.socket.emit('click', { x: 120, y: 80 });
    assert.deepEqual(await aw, []); assert.deepEqual(await bw, []);
    a.socket.emit('click', { x: 'wrong', y: 80 });
    a.socket.emit('click', null);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual(await (await fetch(base + '/health')).json(), { ok: true, circles: 0 });
    assert.equal((await fetch(base + '/server.js')).status, 404);
  } finally {
    clients.forEach(socket => socket.disconnect());
    child.kill();
  }
});
