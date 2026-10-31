'use strict';
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const os = require('node:os');
const express = require('express');
const { Server } = require('socket.io');
const { createInterpreter } = require('./lib/interpreter.cjs');
const phraseData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public/assets/dialogue.json'), 'utf8'));
const phrases = new Map(phraseData.phrases.map(p => [p.id, p.text]));

function createGame(options = {}) {
  const interpreter = options.interpreter || createInterpreter({ mode: options.mode });
  const app = express();
  app.use(express.json({ limit: '8kb' }));
  app.disable('x-powered-by');
  app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 8192, serveClient: true });
  const rooms = new Map();
  const maxRooms = options.maxRooms || 100;
  const retention = options.retention || 30 * 60 * 1000;
  const reclaimAfter = options.reclaimAfter || 10 * 60 * 1000;
  const clock = options.clock || Date.now;
  app.get('/health', (req, res) => res.json({ ok: true, act: 1, mode: interpreter.mode }));
  const validModel = value => typeof value === 'string' && /^[a-zA-Z0-9._:/-]{1,120}$/.test(value);
  const makeEngine = settings => options.interpreter || createInterpreter({ mode: settings.mode || interpreter.mode, model: settings.model || interpreter.model, url: options.ollamaUrl });
  const engineOf = room => room.engine || interpreter;
  const freshRoom = (id, engine = interpreter) => ({ id, phase: 'act1', players: [null, null], messages: [], busy: false, touched: clock(), engine, hostToken: crypto.randomBytes(24).toString('hex'), pending: null });
  const port = () => server.address()?.port || Number(process.env.PORT || 3000);
  const lanAddresses = () => { try { return Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => `http://${n.address}:${port()}`); } catch { return []; } };
  const getOllama = model => createInterpreter({ mode: 'ollama', model: validModel(model) ? model : interpreter.model, url: options.ollamaUrl });
  app.get('/api/status', async (req, res) => {
    const room = rooms.get(req.query.room);
    res.json(await (room ? engineOf(room) : interpreter).status());
  });
  app.get('/api/setup', async (req, res) => res.json({
    ok: true, defaultModel: interpreter.model || 'qwen2.5:1.5b',
    ollama: await getOllama(req.query.model).status(), lanAddresses: lanAddresses()
  }));
  let modelTestBusy = false;
  app.post('/api/model-test', async (req, res) => {
    if (req.get('origin') && req.get('origin') !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ ok: false, error: 'Open this test from the local server.' });
    const { text, model } = req.body || {};
    if (typeof text !== 'string' || !text.trim() || text.length > 280 || !validModel(model)) return res.status(400).json({ ok: false, error: 'Choose a model and enter 1–280 characters.' });
    if (modelTestBusy) return res.status(409).json({ ok: false, error: 'A model test is already running. Please wait.' });
    modelTestBusy = true; const start = clock();
    try { const output = await getOllama(model).interpret(text.trim()); res.json({ ok: true, x: text.trim(), ...output, model, durationMs: clock() - start }); }
    catch (e) { res.status(503).json({ ok: false, error: e.name === 'TimeoutError' ? 'Ollama took too long. Try again after the model loads.' : e.message || 'Ollama could not be reached.' }); }
    finally { modelTestBusy = false; }
  });
  app.post('/api/sessions', (req, res) => {
    if (req.get('origin') && req.get('origin') !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ ok: false, error: 'Create the test from this server.' });
    cleanRooms();
    if (rooms.size >= maxRooms) return res.status(503).json({ ok: false, error: 'All rooms are busy.' });
    const { mode = 'ollama', model = interpreter.model || 'qwen2.5:1.5b' } = req.body || {};
    if (!['ollama', 'direct', 'scripted'].includes(mode) || !validModel(model)) return res.status(400).json({ ok: false, error: 'Choose a supported mode and model.' });
    const id = `act1-${crypto.randomBytes(6).toString('hex')}`;
    const room = freshRoom(id, makeEngine({ mode, model })); rooms.set(id, room);
    res.status(201).json({ ok: true, room: id, hostToken: room.hostToken, mode, model: mode === 'ollama' ? model : null,
      player1: `/player1.html?room=${id}`, player2: `/player2.html?room=${id}`, split: `/dual.html?room=${id}`, lanAddresses: lanAddresses() });
  });
  app.get('/api/sessions/:id/inspect', (req, res) => {
    const room = rooms.get(req.params.id); const token = req.get('x-act1-host-token') || '';
    if (!room || !/^[a-f0-9]{48}$/.test(token) || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(room.hostToken))) return res.status(403).json({ ok: false, error: 'Open the original test setup page to view this record.' });
    res.json({ ok: true, room: room.id, mode: engineOf(room).mode, model: engineOf(room).mode === 'ollama' ? engineOf(room).model : null,
      phase: room.phase, busy: room.busy, pending: room.pending,
      players: room.players.map((p, i) => ({ player: i + 1, connected: isPresent(p), sent: p?.sent || 0, ready: p?.ready || false })),
      messages: room.messages.map(m => ({ ...m, player: m.from === 'human' ? 1 : 2 })) });
  });
  app.get(['/player1.html', '/player2.html'], (req, res) => res.sendFile(path.join(__dirname, 'public/chat.html')));
  // Production dependencies are served locally; no CDN is needed for p5 drawing.
  app.use('/vendor/p5', express.static(path.join(__dirname, 'public/vendor/p5')));
  app.use(express.static(path.join(__dirname, 'public')));

  const isPresent = p => Boolean(p && p.socketId && io.sockets.sockets.get(p.socketId)?.connected);
  function roomState(room, player) {
    return {
      room: room.id, role: player.role, phase: room.phase, busy: room.busy,
      mode: engineOf(room).mode, model: engineOf(room).mode === 'ollama' ? engineOf(room).model : null, player: player.role === 'human' ? 1 : 2, pending: room.pending ? { from: room.pending.from } : null, paired: room.players.every(isPresent),
      players: room.players.map(p => p ? ({ role: p.role, connected: isPresent(p), ready: p.ready, sent: p.sent }) : null),
      // Keep the other player's x private until Act II exists. Never broadcast the audit array.
      messages: room.messages.map(m => m.from === player.role
        ? { id: m.id, kind: 'sent', text: m.x, at: m.at, delivered: true, engine: m.engine, durationMs: m.durationMs }
        : { id: m.id, kind: 'received', text: m.y, tone: m.tone, at: m.at, engine: m.engine })
    };
  }
  function publish(room) {
    for (const p of room.players) if (isPresent(p)) io.to(p.socketId).emit('state', roomState(room, p));
  }
  function context(socket) {
    const room = rooms.get(socket.data.room);
    const player = room?.players.find(p => p?.socketId === socket.id);
    return player ? { room, player } : null;
  }
  function cleanRooms() {
    for (const [key, room] of rooms) {
      if (!room.players.some(isPresent) && !room.busy && clock() - room.touched > retention) rooms.delete(key);
    }
  }
  const cleaner = setInterval(cleanRooms, 60000);
  cleaner.unref();

  io.on('connection', socket => {
    function joinRoom(data = {}, ack = () => {}) {
      if (typeof ack !== 'function') return;
      if (!data || typeof data !== 'object' || Array.isArray(data)) { ack({ ok: false, error: 'Invalid room request.' }); return; }
      if (socket.data.room) { ack({ ok: false, error: 'Already in a room.' }); return; }
      const id = typeof data.room === 'string' ? data.room.toLowerCase().trim() : '';
      const token = data.token;
      if (!/^[a-z0-9][a-z0-9-]{1,35}$/.test(id) || typeof token !== 'string' || !/^[a-zA-Z0-9-]{20,80}$/.test(token)) {
        ack({ ok: false, error: 'Use 2–36 letters, numbers, or hyphens for the room name.' }); return;
      }
      cleanRooms();
      let room = rooms.get(id);
      if (!room) {
        if (rooms.size >= maxRooms) { ack({ ok: false, error: 'All rooms are busy. Please try again later.' }); return; }
        room = freshRoom(id);
        rooms.set(id, room);
      }
      let player = room.players.find(p => p?.token === token);
      if (player && isPresent(player)) { ack({ ok: false, error: 'This seat is already open. Use the second-player link for another window.' }); return; }
      if (!player) {
        // Only reclaim a disconnected seat after the grace period. Never evict a live player.
        const requested = data.player === 1 || data.player === 2 ? data.player - 1 : null;
        if (requested !== null && room.players[requested]) { ack({ ok: false, error: `Player ${requested + 1} is already open. Close that window or create a new test session.` }); return; }
        let slot = requested !== null ? requested : room.players.findIndex(p => !p);
        if (slot < 0) slot = room.players.findIndex(p => !isPresent(p) && clock() - p.offlineAt > reclaimAfter);
        if (slot < 0) { ack({ ok: false, error: 'This room has two seats. Rejoin your own seat or choose a new room.' }); return; }
        if (room.players[slot]) {
          // A replacement starts a fresh conversation; it must not inherit the previous pair's transcript.
          room.messages = []; room.phase = 'act1';
          for (const p of room.players) if (p) { p.sent = 0; p.ready = false; }
        }
        player = { token, role: slot === 0 ? 'human' : 'robot', sent: 0, ready: false, socketId: null, offlineAt: null };
        room.players[slot] = player;
      }
      player.socketId = socket.id; player.offlineAt = null;
      socket.data.room = id; socket.join(id); room.touched = clock();
      if (room.players.every(isPresent)) room.matching = false;
      ack({ ok: true, role: player.role, room: room.id }); publish(room);
    }
    socket.on('join', joinRoom);

    // Pair two visitors who explicitly choose to meet someone new.
    // Invite-code rooms do not enter the matching queue.
    socket.on('match:find', (data = {}, ack = () => {}) => {
      if (typeof ack !== 'function') return;
      if (!data || typeof data.token !== 'string' || !/^[a-zA-Z0-9-]{20,80}$/.test(data.token)) {
        ack({ ok: false, error: 'The connection could not be started.' }); return;
      }
      const candidate = [...rooms.values()].find(room => room.matching && isPresent(room.players[0]) && !room.players[1]);
      const id = candidate?.id || `chat-${crypto.randomBytes(5).toString('hex')}`;
      joinRoom({ room: id, token: data.token }, result => {
        if (result.ok && !candidate) rooms.get(id).matching = true;
        ack(result);
      });
    });

    socket.on('typing', active => {
      const c = context(socket);
      if (!c || !c.room.players.every(isPresent) || typeof active !== 'boolean') return;
      const now = clock();
      if (active && now - (socket.data.lastTyping || 0) < 250) return;
      socket.data.lastTyping = now;
      socket.to(c.room.id).emit('typing', active);
    });

    socket.on('message:send', async (data = {}, ack = () => {}) => {
      if (typeof ack !== 'function') return;
      if (!data || typeof data !== 'object' || Array.isArray(data)) { ack({ ok: false, error: 'Choose a phrase or write a message.' }); return; }
      const c = context(socket);
      if (!c) { ack({ ok: false, error: 'Join a room first.' }); return; }
      const { room, player } = c;
      if (!room.players.every(isPresent)) { ack({ ok: false, error: 'Wait for the other connection to return.' }); return; }
      if (room.phase !== 'act1' || room.busy) { ack({ ok: false, error: 'Please wait for the current message.' }); return; }
      const phraseId = typeof data.phraseId === 'string' ? data.phraseId : null;
      const x = phraseId ? phrases.get(phraseId) : (typeof data.text === 'string' ? data.text.trim() : '');
      if (!x || x.length > 280) { ack({ ok: false, error: 'Choose a phrase or write 1–280 characters.' }); return; }
      if (player.lastMessageAt && clock() - player.lastMessageAt < 500) { ack({ ok: false, error: 'Give the words a moment.' }); return; }
      if (room.messages.length >= 80) { ack({ ok: false, error: 'This conversation is full. Start a new room.' }); return; }
      player.lastMessageAt = clock(); room.busy = true; room.pending = { from: player.role, x, at: clock() }; room.touched = clock(); publish(room);
      const inferenceStart = clock();
      try {
        // x = the real player's input. y = an interpretation of x, not an invented partner reply.
        const { y, tone, engine } = await engineOf(room).interpret(x, phraseId);
        if (typeof y !== 'string' || !y.trim() || y.length > 480) throw new Error('The interpretation was not readable.');
        if (rooms.get(room.id) !== room) throw new Error('This room has closed.');
        room.messages.push({ id: crypto.randomUUID(), from: player.role, x, y: y.trim(), tone, engine, at: clock(), durationMs: clock() - inferenceStart });
        player.sent += 1; player.ready = false;
        for (const p of room.players) if (p) p.ready = false;
        ack({ ok: true });
      } catch (error) {
        const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
        const offline = error.cause?.code === 'ECONNREFUSED' || error.message === 'fetch failed';
        ack({ ok: false, error: timeout ? 'The local model took too long. Please retry.' : offline
          ? 'Ollama is not running on the server computer. Open it and try again.'
          : 'The local model could not interpret this message. Check Ollama and retry.' });
      } finally { room.busy = false; room.pending = null; room.touched = clock(); publish(room); }
    });

    socket.on('presence', data => {
      const c = context(socket);
      if (!c || !data || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
      const now = clock();
      if (now - (socket.data.lastPresence || 0) < 60) return;
      socket.data.lastPresence = now;
      socket.to(c.room.id).emit('presence', {
        x: Math.max(0, Math.min(1, data.x)), y: Math.max(0, Math.min(1, data.y)), role: c.player.role
      });
    });

    socket.on('ready', (value, ack = () => {}) => {
      if (typeof ack !== 'function') return;
      const c = context(socket);
      if (!c || c.room.phase !== 'act1' || c.room.busy || !c.room.players.every(p => isPresent(p) && p.sent >= 2)) {
        ack({ ok: false, error: 'Exchange at least two messages each before leaving this room together.' }); return;
      }
      c.player.ready = value === true;
      if (c.room.players.every(p => p.ready)) c.room.phase = 'act1-ended';
      ack({ ok: true }); publish(c.room);
    });
    socket.on('disconnect', () => {
      const c = context(socket);
      if (!c) return;
      c.player.socketId = null; c.player.offlineAt = clock(); c.player.ready = false;
      socket.to(c.room.id).emit('typing', false);
      if (c.room.matching && !c.room.players[1]) {
        rooms.delete(c.room.id); return;
      }
      c.room.touched = clock(); publish(c.room);
    });
  });

  return { app, io, server, rooms, interpreter,
    async close() { clearInterval(cleaner); await new Promise(resolve => io.close(resolve)); }
  };
}
if (require.main === module) {
  const game = createGame({ mode: process.argv.includes('--demo') ? 'scripted' : undefined });
  const port = Number(process.env.PORT || 3000);
  game.server.listen(port, process.env.HOST || '0.0.0.0', () => {
    console.log(`Act I · http://localhost:${game.server.address().port} · ${game.interpreter.mode}`);
    console.log(game.interpreter.mode === 'scripted' ? 'Rehearsal mode: fixed lines, no language model.' : 'Ollama runs on this server computer; browsers connect through Node.');
  });
  let shuttingDown = false;
  const stop = () => { if (shuttingDown) return; shuttingDown = true; game.close().then(() => process.exit(0)); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
module.exports = { createGame };
