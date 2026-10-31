'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const preview = ['human', 'robot'].includes(params.get('preview')) ? params.get('preview') : null;
  let socket, state, phrases, page = 0, pending = false, rendered = '', cameraBusy = false;
  let scene = { role: 'human', paired: false, own: { x: .5, y: .5 }, peer: { x: .5, y: .5 } };
  let art, lobbyArt, lastPresence = 0, statusReady = false;
  const room = params.get('room') || '';
  // getRandomValues also works on plain LAN HTTP; randomUUID requires HTTPS.
  const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');
  $('room-input').value = room;
  function setError(text) { $('send-error').textContent = text || ''; }
  function updateControls() {
    const canSend = state?.paired && state.phase === 'act1' && !state.busy && !pending && (preview || statusReady);
    document.querySelectorAll('.phrase, #free-form button, #free-text').forEach(b => { b.disabled = !canSend; });
    const eligible = state?.players?.every(p => p?.connected && p.sent >= 2) && !state?.busy;
    $('ready-button').disabled = !eligible || state?.phase !== 'act1';
  }
  function makePhrases() {
    $('phrases').replaceChildren();
    const start = page * 4;
    for (const phrase of phrases.slice(start, start + 4)) {
      const b = document.createElement('button'); b.className = 'phrase'; b.dataset.gesture = '';
      b.dataset.phraseId = phrase.id; b.textContent = phrase.text;
      b.addEventListener('click', () => send({ phraseId: phrase.id })); $('phrases').append(b);
    }
    updateControls();
  }
  function renderMessages() {
    const signature = JSON.stringify(state.messages);
    if (signature === rendered) return;
    const hadMessages = Boolean(rendered && rendered !== '[]'); rendered = signature;
    if (!state.messages.length) return;
    $('messages').replaceChildren();
    for (const message of state.messages) {
      const el = document.createElement('div'); el.className = `message ${message.kind}`;
      const label = document.createElement('span'); label.className = 'message-label';
      label.textContent = message.kind === 'sent' ? 'YOU' : state.role === 'robot' ? 'COMPANION' : 'THE OTHER END';
      const p = document.createElement('p'); p.textContent = message.text;
      el.append(label, p); $('messages').append(el);
    }
    $('messages').scrollTop = $('messages').scrollHeight;
    if (hadMessages) scene.pulse = Date.now();
  }
  function render(next) {
    state = next; scene.role = next.role; scene.paired = next.paired; scene.busy = next.busy;
    document.body.dataset.role = next.role;
    $('room-label').textContent = `room / ${next.room}`;
    $('connection').textContent = next.paired ? 'A connection is here' : 'Waiting for a connection';
    $('identity-note').textContent = next.role === 'robot' ? 'YOUR ROOM / COMPANION LINK' : 'YOUR ROOM / EVENING';
    $('chat-kicker').textContent = next.role === 'robot' ? 'YOUR COMPANION' : 'A FAMILIAR VOICE';
    $('chat-title').textContent = next.role === 'robot' ? 'Always at the other end' : 'At the other end';
    $('room-poem').innerText = next.role === 'robot' ? 'A familiar shape.\nA comforting reply.' : 'The room is quiet.\nThe screen is not.';
    $('scene-caption').textContent = !next.paired ? 'A screen lights up. You wait.' : next.busy ? 'Somewhere, a sentence is taking shape.' : 'A light is on at the other end.';
    $('send-status').textContent = next.busy ? 'The words are travelling…' : !next.paired ? 'Share this room link and wait for the second player.' : '';
    const mine = next.players.find(p => p?.role === next.role);
    $('ready-button').textContent = mine?.ready ? 'Waiting for the other person…' : 'Leave this room together →';
    $('ending').hidden = next.phase !== 'act1-ended';
    if (next.phase === 'act1-ended') GestureInput.stop();
    if (next.mode === 'scripted') $('mode-banner').hidden = false;
    renderMessages(); updateControls();
  }
  async function showGame() {
    $('lobby').hidden = true; $('game').hidden = false;
    lobbyArt?.destroy(); lobbyArt = null;
    if (!art) {
      try { art = await RoomArt.mount('room-canvas', () => scene); }
      catch (error) { setError(error.message); }
    }
  }
  async function refreshStatus() {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) throw new Error('Server unavailable.');
      const status = await response.json(); statusReady = status.ready;
      $('engine-status').textContent = status.mode === 'scripted' ? 'Rehearsal: fixed dialogue. No language model is being called.'
        : `Ollama / ${status.model} · ${status.ready ? 'local model ready' : status.detail}`;
      $('mode-banner').hidden = status.mode !== 'scripted';
      if (!status.ready) { $('send-error').textContent = 'The local model is not ready. Open “Room & rehearsal details” below to check it.'; }
      else if ($('send-error').textContent.startsWith('The local model is not ready.')) setError('');
    } catch { statusReady = false; $('engine-status').textContent = 'Cannot reach the server. Keep the terminal open and reconnect.'; }
    updateControls();
  }
  function send(payload) {
    if (pending || !state?.paired || state?.busy || state?.phase !== 'act1') return;
    setError('');
    if (preview) { setError('Visual preview only. Enter a real room on two devices to exchange messages.'); return; }
    pending = true; updateControls();
    socket.timeout(100000).emit('message:send', payload, (err, result) => {
      pending = false;
      if (err || !result?.ok) setError(err ? 'The server took too long to reply. Reconnect before retrying.' : result.error);
      else if (payload.text) $('free-text').value = '';
      updateControls();
    });
  }
  function point(position) {
    scene.own = position;
    if (!socket?.connected || !state || Date.now() - lastPresence < 80) return;
    lastPresence = Date.now(); socket.emit('presence', position);
  }
  async function join(name) {
    $('join-error').textContent = ''; document.querySelector('#join-form button').disabled = true;
    if (!window.io) { $('join-error').textContent = 'Start the Node server with npm start or npm run demo, then open localhost:3000.'; document.querySelector('#join-form button').disabled = false; return; }
    socket?.disconnect();
    socket = io({ autoConnect: false });
    const key = `between-us-seat:${name}`;
    let token;
    try {
      token = params.has('new') ? null : sessionStorage.getItem(key);
      if (!token) { token = newToken(); sessionStorage.setItem(key, token); }
    } catch { token = newToken(); }
    const url = new URL(location.href); url.search = ''; url.searchParams.set('room', name);
    history.replaceState({}, '', url);
    $('partner-link').href = `${url}&new=1`;
    socket.on('connect', () => {
      socket.timeout(8000).emit('join', { room: name, token }, async (error, result) => {
        document.querySelector('#join-form button').disabled = false;
        if (error || !result?.ok) {
          const message = result?.error || 'The room could not be reached. Please try again.';
          $('join-error').textContent = message; setError(message); socket.disconnect(); return;
        }
        await showGame(); refreshStatus();
      });
    });
    socket.on('state', render);
    socket.on('presence', position => { scene.peer = position; });
    socket.on('disconnect', () => {
      if (state) { state.paired = false; scene.paired = false; $('connection').textContent = 'Reconnecting…'; $('send-status').textContent = 'Connection paused. Your seat will be kept for ten minutes.'; updateControls(); }
    });
    socket.on('connect_error', () => {
      document.querySelector('#join-form button').disabled = false;
      $('join-error').textContent = 'Cannot reach the server. Check that the terminal is still running.';
    });
    socket.connect();
  }
  $('join-form').addEventListener('submit', event => {
    event.preventDefault(); const name = $('room-input').value.trim().toLowerCase();
    if (/^[a-z0-9][a-z0-9-]{1,35}$/.test(name)) join(name);
    else $('join-error').textContent = 'Use 2–36 letters, numbers or hyphens.';
  });
  $('change-phrases').addEventListener('click', () => { page = (page + 1) % Math.ceil(phrases.length / 4); makePhrases(); });
  $('write-toggle').addEventListener('click', () => { $('free-form').hidden = !$('free-form').hidden; if (!$('free-form').hidden) $('free-text').focus(); });
  $('free-form').addEventListener('submit', event => { event.preventDefault(); const text = $('free-text').value.trim(); if (text) send({ text }); });
  $('ready-button').addEventListener('click', () => {
    if (preview) return;
    const me = state.players.find(p => p?.role === state.role);
    socket.emit('ready', !me.ready, result => { if (!result.ok) setError(result.error); });
  });
  $('camera-toggle').addEventListener('click', async () => {
    if (cameraBusy) return; cameraBusy = true;
    await GestureInput.toggle({ onPoint: point, onStatus: message => { $('input-help').textContent = message; } }); cameraBusy = false;
  });
  window.addEventListener('pointermove', event => {
    if (!state) return;
    point({ x: event.clientX / innerWidth, y: event.clientY / innerHeight });
  }, { passive: true });
  $('refresh-status').addEventListener('click', refreshStatus);
  $('copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); $('copy-link').textContent = 'Room link copied ✓'; }
    catch { $('send-status').textContent = `Copy the address above: ${location.href}`; }
  });
  fetch('assets/dialogue.json').then(r => r.json()).then(async data => {
    phrases = data.phrases; makePhrases();
    if (preview) {
      $('mode-banner').hidden = false;
      $('mode-banner').textContent = 'VISUAL PREVIEW · Sample conversation. No remote player or language model is connected.';
      render({ room: 'visual-preview', role: preview, phase: 'act1', busy: false, paired: true, mode: 'preview',
        players: [{ role: 'human', connected: true, sent: 1 }, { role: 'robot', connected: true, sent: 1 }],
        messages: [{ id: 'sample-1', kind: 'sent', text: 'Are you there?' }, { id: 'sample-2', kind: 'received', text: 'I have left a small light on for you.' }] });
      await showGame(); $('engine-status').textContent = 'Visual preview only.';
    } else {
      RoomArt.mount('lobby-canvas', () => ({ role: 'human', paired: false })).then(result => {
        if ($('lobby').hidden) result.destroy(); else lobbyArt = result;
      }).catch(e => { $('join-error').textContent = e.message; });
      if (room) join(room.toLowerCase());
    }
  }).catch(() => { $('join-error').textContent = 'The scene files could not load. Run npm start and open the local server address.'; });
})();
