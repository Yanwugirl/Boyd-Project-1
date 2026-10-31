'use strict';
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const express = require('express');
const { Server } = require('socket.io');
const { createInterpreter } = require('./lib/interpreter.cjs');
const phraseData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public/assets/dialogue.json'), 'utf8'));
const phrases = new Map(phraseData.phrases.map(p => [p.id, p.text]));

function createGame(options = {}) {
  const interpreter = options.interpreter || createInterpreter({ mode: options.mode });
  const app = express();
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
  app.get('/api/status', async (req, res) => res.json(await interpreter.status()));
  // Production dependencies are served locally; no CDN is needed for p5 drawing.
  app.use('/vendor/p5', express.static(path.join(__dirname, 'public/vendor/p5')));
  app.use(express.static(path.join(__dirname, 'public')));

  const isPresent = p => Boolean(p && p.socketId && io.sockets.sockets.get(p.socketId)?.connected);
  function roomState(room, player) {
    return {
      room: room.id, role: player.role, phase: room.phase, busy: room.busy,
      mode: interpreter.mode, paired: room.players.every(isPresent),
      players: room.players.map(p => p ? ({ role: p.role, connected: isPresent(p), ready: p.ready, sent: p.sent }) : null),
      // Keep the other player's x private until Act II exists. Never broadcast the audit array.
      messages: room.messages.map(m => m.from === player.role
        ? { id: m.id, kind: 'sent', text: m.x, at: m.at, delivered: true }
        : { id: m.id, kind: 'received', text: m.y, tone: m.tone, at: m.at })
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
    socket.on('join', (data = {}, ack = () => {}) => {
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
        room = { id, phase: 'act1', players: [null, null], messages: [], busy: false, touched: clock() };
        rooms.set(id, room);
      }
      let player = room.players.find(p => p?.token === token);
      if (player && isPresent(player)) { ack({ ok: false, error: 'This seat is already open. Use the second-player link for another window.' }); return; }
      if (!player) {
        // Only reclaim a disconnected seat after the grace period. Never evict a live player.
        let slot = room.players.findIndex(p => !p);
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
      ack({ ok: true, role: player.role }); publish(room);
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
      player.lastMessageAt = clock(); room.busy = true; room.touched = clock(); publish(room);
      try {
        // x = the real player's input. y = an interpretation of x, not an invented partner reply.
        const { y, tone, engine } = await interpreter.interpret(x, phraseId);
        if (typeof y !== 'string' || !y.trim() || y.length > 480) throw new Error('The interpretation was not readable.');
        if (rooms.get(room.id) !== room) throw new Error('This room has closed.');
        room.messages.push({ id: crypto.randomUUID(), from: player.role, x, y: y.trim(), tone, engine, at: clock() });
        player.sent += 1; player.ready = false;
        for (const p of room.players) if (p) p.ready = false;
        ack({ ok: true });
      } catch (error) {
        const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
        const offline = error.cause?.code === 'ECONNREFUSED' || error.message === 'fetch failed';
        ack({ ok: false, error: timeout ? 'The local model took too long. Please retry.' : offline
          ? 'Ollama is not running on the server computer. Open it and try again.'
          : 'The local model could not interpret this message. Check Ollama and retry.' });
      } finally { room.busy = false; room.touched = clock(); publish(room); }
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
