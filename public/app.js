'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const requestedPlayer = location.pathname.includes('player2') ? 2 : location.pathname.includes('player1') ? 1 : Number(params.get('player')) || undefined;
  const room = params.get('room') || '';
  const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
  const quickPhrases = { hello: 'Are you there?', day: 'How was your day?', here: 'I am here with you.' };
  let socket, state, modelReady = false, pending = false, readyPending = false, pendingText = '', signature = '', typingTimer, statusTimer, toastTimer;
  function error(text) { $('send-error').textContent = text || ''; }
  function notify(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500); }
  function resize() { $('message-input').style.height = 'auto'; $('message-input').style.height = `${Math.min(105, $('message-input').scrollHeight)}px`; $('character-count').textContent = `${$('message-input').value.length} / 280`; }
  function controls() {
    const joined = state?.paired && state.phase === 'act1';
    const canSend = joined && modelReady && !state.busy && !pending;
    $('message-input').disabled = !joined;
    $('send-button').disabled = !canSend || !$('message-input').value.trim();
    document.querySelectorAll('[data-phrase]').forEach(b => { b.disabled = !canSend; });
    const me = state?.players.find(p => p?.role === state.role);
    const partner = state?.players.find(p => p && p.role !== state.role);
    const ended = state?.journey?.completed?.includes('act1') || state?.phase === 'act1-ended';
    const canContinue = joined && !state.busy && !pending && !readyPending && state.players.every(p => p?.connected && p.sent >= 2);
    const invited = joined && partner?.ready && !me?.ready;
    $('ready-button').disabled = !canContinue || me?.ready;
    $('ready-button').textContent = ended ? 'Act I complete' : me?.ready ? 'Waiting for your partner…' : invited ? 'Continue with your partner' : 'Continue together';
    $('ready-button').classList.toggle('partner-ready', Boolean(invited));
    $('ready-button').title = ended ? 'Both players have completed Act I.' : me?.ready ? 'Your partner has been notified. You can cancel using Keep chatting below.' : 'Both players must confirm to open the next space.';
    $('continue-notice').hidden = !joined || (!me?.ready && !partner?.ready);
    $('continue-notice').classList.toggle('awaiting-response', Boolean(invited));
    $('continue-title').textContent = invited ? 'Your partner is ready to continue.' : 'You’re ready to continue.';
    $('continue-description').textContent = invited ? 'They chose Continue together. The next space opens when you both agree.' : 'Your partner has been notified. Waiting for their confirmation. Choose Keep chatting to cancel your request.';
    $('continue-action').textContent = invited ? 'Continue together' : 'Keep chatting';
    $('continue-action').disabled = !canContinue;
    if (!state || state.phase === 'act1') document.title = invited ? 'Partner ready to continue · Between Us' : 'Between Us';
  }
  function chooseContinue(value) {
    if (!socket?.connected || !state?.paired || state.phase !== 'act1' || state.busy || pending || readyPending) return;
    error(''); readyPending = true; controls();
    socket.timeout(8000).emit('ready', value, (err, result) => {
      readyPending = false;
      if (err || !result?.ok) error(result?.error || 'Your confirmation could not be sent. Check the connection and try again.');
      controls();
    });
  }
  function drawMessages() {
    if (!state) return;
    const list = [...state.messages];
    if (pending && pendingText) list.push({ id: 'in-flight', kind: 'sent', text: pendingText, at: Date.now(), pending: true });
    const nextSignature = JSON.stringify(list.map(m => ({ ...m, at: m.pending ? 0 : m.at })));
    if (nextSignature === signature) return; signature = nextSignature;
    $('messages').replaceChildren(); $('conversation-start').hidden = !state.paired || list.length > 0;
    if (!list.length) return;
    const divider = document.createElement('div'); divider.className = 'date-divider'; divider.textContent = 'Act I'; $('messages').append(divider);
    for (const m of list) {
      const row = document.createElement('article'); row.className = `message ${m.kind}${m.pending ? ' pending-message' : ''}`;
      const avatar = document.createElement('span'); avatar.className = 'message-avatar'; avatar.textContent = state.role === 'robot' ? '◦' : '?';
      const content = document.createElement('div'); content.className = 'message-content';
      const meta = document.createElement('div'); meta.className = 'message-meta';
      const name = document.createElement('strong'); name.textContent = m.kind === 'sent' ? 'You' : state.role === 'robot' ? 'Companion' : 'Someone';
      const time = document.createElement('span'); time.textContent = new Date(m.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const bubble = document.createElement('p'); bubble.className = 'bubble'; bubble.textContent = m.text;
      meta.append(name, time); content.append(meta, bubble);
      if (m.kind === 'sent') { const delivery = document.createElement('div'); delivery.className = 'delivery'; delivery.textContent = m.pending ? state.mode === 'ollama' ? 'Sending your words…' : 'Sending…' : 'Delivered ✓'; content.append(delivery); }
      row.append(avatar, content); $('messages').append(row);
    }
    requestAnimationFrame(() => { $('chat-body').scrollTop = $('chat-body').scrollHeight; });
  }
  function render(next) {
    state = next;
    const p = next.player || (next.role === 'human' ? 1 : 2);
    $('player-label').textContent = `PLAYER ${p}`;
    $('sidebar-status').textContent = `Player ${p} · ${next.phase === 'act1-ended' ? 'Act I complete' : next.paired ? 'Connected' : 'Waiting'}`;
    $('partner-name').textContent = p === 2 ? 'Companion' : 'Someone';
    $('connection-status').textContent = next.phase === 'act1-ended' ? 'Act I complete · Both players confirmed' : next.paired ? next.busy ? 'A message is on its way…' : 'Connected · Say hello' : 'Waiting for your partner';
    $('partner-dot').classList.toggle('connected', next.paired);
    $('people-count').textContent = next.paired ? '2 participants' : '1 participant';
    $('opening-title').textContent = p === 1 ? 'An ordinary conversation.' : 'Your companion is here.';
    $('opening-description').textContent = p === 1 ? 'You are at home. A familiar screen lights up.' : 'A quiet moment. A screen that seems to understand.';
    $('room-label').textContent = `Room: ${next.room} · Player ${p}`;
    $('live-details').hidden = false;
    $('info-mode').textContent = 'Your place stays with you through the experience. Both of you choose when to move forward.';
    $('room-code-text').textContent = next.room;
    $('waiting').hidden = next.paired || next.phase !== 'act1'; $('messages').hidden = !next.paired; $('conversation-start').hidden = !next.paired || next.messages.length > 0;
    $('waiting-title').textContent = next.messages.length ? 'Connection paused.' : `Waiting for Player ${p === 1 ? 2 : 1}…`;
    $('waiting-description').textContent = next.messages.length ? 'Your partner can return to the same invitation.' : 'Share the other invitation from the room launcher to begin.';
    $('cancel-search').textContent = 'Return to start';
    if (next.phase === 'act1-ended') GestureInput.stop();
    if (!next.paired || next.phase !== 'act1') $('typing').hidden = true;
    $('preview-notice').hidden = modelReady;
    $('preview-notice-text').textContent = 'Getting the connection ready. Please ask the host if this takes a while.';
    drawMessages(); controls();
    Experience.update(next, socket).catch(() => error('The next space could not open. Please reconnect to this room.'));
  }
  async function checkStatus() {
    if (!state || state.phase !== 'act1') return;
    try {
      const r = await fetch(`/api/status?room=${encodeURIComponent(state.room)}`); const info = await r.json(); modelReady = info.ready;
      if (info.mode === 'ollama' && !info.ready) { $('preview-notice').hidden = false; $('preview-notice-text').textContent = 'The connection is not ready. Please ask the host to check the room.'; }
      else { $('preview-notice').hidden = true; }
      controls();
    } catch { modelReady = false; error('The server could not be reached. Keep the terminal open.'); controls(); }
  }
  function connect() {
    if (!window.io) { error('Start the Node server, then open this page from its address.'); return; }
    const key = `act1:${room}:player:${requestedPlayer || 'auto'}`; let token;
    try { token = localStorage.getItem(key) || newToken(); localStorage.setItem(key, token); } catch { token = newToken(); }
    socket = io({ autoConnect: false });
    socket.on('connect', () => socket.timeout(8000).emit('join', { room, token, player: requestedPlayer, requireExisting: true }, (err, result) => {
      if (err || !result?.ok) { error(result?.error || 'Cannot join this room. Return to the start and ask for a new invitation.'); $('waiting-title').textContent = 'Your place could not open.'; $('waiting-description').textContent = 'Use your original view, or create a new room when changing devices.'; return; }
      const assigned = result.role === 'human' ? 1 : 2;
      try { localStorage.setItem(`act1:${room}:player:${assigned}`, token); if (!requestedPlayer) localStorage.setItem(`act1:${room}:player:auto`, token); } catch {}
      checkStatus(); clearInterval(statusTimer); statusTimer = setInterval(checkStatus, 6000);
    }));
    socket.on('state', next => { const first = !state; render(next); if (first) checkStatus(); });
    socket.on('stage:state', next => Experience.updateStage(next));
    socket.on('typing', active => { $('typing').hidden = !active || !state?.paired || state?.phase !== 'act1'; });
    socket.on('disconnect', () => { if (state) state.paired = false; if (state?.phase !== 'act1-ended') $('connection-status').textContent = 'Reconnecting…'; $('partner-dot').classList.remove('connected'); $('typing').hidden = true; Experience.disconnected(); controls(); });
    socket.on('connect_error', () => error('The server could not be reached. Keep the terminal open.'));
    socket.connect();
  }
  function send(text, phraseId) {
    if (!state?.paired || !modelReady || state.busy || pending || !text.trim()) return;
    error(''); pending = true; pendingText = text.trim(); socket.emit('typing', false); controls(); drawMessages();
    socket.timeout(125000).emit('message:send', phraseId ? { phraseId } : { text: text.trim() }, (err, result) => {
      pending = false; pendingText = '';
      if (err || !result?.ok) error(result?.error || 'Sending timed out. Check the connection before retrying.');
      else { $('message-input').value = ''; resize(); }
      controls(); drawMessages();
    });
  }
  $('message-form').addEventListener('submit', e => { e.preventDefault(); send($('message-input').value); });
  $('message-input').addEventListener('input', () => { resize(); controls(); if (socket?.connected && state?.paired) { socket.emit('typing', true); clearTimeout(typingTimer); typingTimer = setTimeout(() => socket?.connected && socket.emit('typing', false), 1400); } });
  $('message-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!$('send-button').disabled) send($('message-input').value); } });
  document.querySelectorAll('[data-phrase]').forEach(b => b.addEventListener('click', () => send(quickPhrases[b.dataset.phrase], b.dataset.phrase)));
  $('ready-button').addEventListener('click', () => chooseContinue(true));
  $('continue-action').addEventListener('click', () => chooseContinue(!state.players.find(p => p?.role === state.role)?.ready));
  $('cancel-search').addEventListener('click', () => { location.href = '/'; });
  $('end-button').addEventListener('click', () => { socket?.disconnect(); clearInterval(statusTimer); GestureInput.stop(); location.href = '/'; });
  $('copy-link').hidden = false;
  $('copy-link').addEventListener('click', async () => { if (!state) return; try { await navigator.clipboard.writeText(state.room); notify('Room code copied.'); } catch { notify('Select and copy the room code shown above.'); } });
  $('info-button').addEventListener('click', () => $('info-dialog').showModal());
  $('close-info').addEventListener('click', () => $('info-dialog').close()); $('close-info-bottom').addEventListener('click', () => $('info-dialog').close());
  $('refresh-player-status').addEventListener('click', checkStatus);
  $('camera-toggle').addEventListener('click', () => GestureInput.toggle({ onPoint: () => {}, onStatus: message => { $('input-help').textContent = message; } }));
  $('join-form').addEventListener('submit', e => { e.preventDefault(); const id = $('room-input').value.trim(); if (/^[a-z0-9][a-z0-9-]{1,35}$/.test(id)) location.href = `/play.html?room=${encodeURIComponent(id)}`; });
  $('waiting').hidden = false; $('conversation-start').hidden = true;
  $('waiting-title').textContent = 'Enter a shared room.'; $('waiting-description').textContent = 'Open your invitation, or use a room code from the start page.'; $('cancel-search').textContent = 'Return to start';
  $('message-input').disabled = true; $('send-button').disabled = true; document.querySelectorAll('[data-phrase]').forEach(b => { b.disabled = true; });
  if (room) connect();
  window.addEventListener('pagehide', () => { clearInterval(statusTimer); socket?.disconnect(); Experience.destroy(); });
})();
