'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const staticPreview = document.documentElement.dataset.preview === 'true';
  let socket, state, view = 'preview', pending = false, ready = false, typingTimer, toastTimer;
  let currentRoom = '', currentToken = '', messageSignature = '';
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
  const quickPhrases = { hello: 'Are you there?', day: 'How was your day?', here: 'I am here with you.' };
  const sample = [
    { id: 'e1', kind: 'received', text: "Hey, how's your evening going?", time: '20:41' },
    { id: 'e2', kind: 'sent', text: "Pretty quiet. I've just finished a long day.", time: '20:41' },
    { id: 'e3', kind: 'received', text: "Same here. It's nice to talk to someone new.", time: '20:42' },
    { id: 'e4', kind: 'sent', text: 'Yeah. No introductions, no expectations.', time: '20:42' },
    { id: 'e5', kind: 'received', text: "So, what's one thing that made you smile today?", time: '20:43' }
  ];
  let previewMessages = [];
  function error(message) { $('send-error').textContent = message || ''; }
  function notify(message) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200);
  }
  function controls() {
    const enabled = view === 'preview' || (view === 'live' && state?.paired && !state?.busy && state.phase === 'act1' && ready && !pending);
    $('message-input').disabled = !enabled;
    $('send-button').disabled = !enabled || !$('message-input').value.trim();
    document.querySelectorAll('[data-phrase]').forEach(button => { button.disabled = !enabled; });
    $('end-button').disabled = view === 'ended';
    $('message-input').placeholder = view === 'searching' ? 'Waiting for a connection…' : view === 'ended' ? 'Start a new conversation to keep chatting…' : 'Write a message…';
  }
  function header(status, sidebar, connected = false) {
    $('connection-status').textContent = status; $('sidebar-status').textContent = sidebar;
    $('partner-dot').classList.toggle('connected', connected);
  }
  function drawMessages(messages) {
    const signature = JSON.stringify(messages);
    if (signature === messageSignature) return;
    messageSignature = signature;
    const nearBottom = $('chat-body').scrollHeight - $('chat-body').scrollTop - $('chat-body').clientHeight < 100;
    $('messages').replaceChildren();
    if (!messages.length) return;
    const date = document.createElement('div'); date.className = 'date-divider'; date.textContent = view === 'preview' ? 'Example conversation' : 'Today'; $('messages').append(date);
    for (const message of messages) {
      const row = document.createElement('article'); row.className = `message ${message.kind}`;
      const avatar = document.createElement('span'); avatar.className = 'message-avatar'; avatar.textContent = '?'; avatar.setAttribute('aria-hidden', 'true');
      const content = document.createElement('div'); content.className = 'message-content';
      const meta = document.createElement('div'); meta.className = 'message-meta';
      const name = document.createElement('strong'); name.textContent = message.kind === 'sent' ? 'You' : 'Stranger';
      const time = document.createElement('span'); time.textContent = message.time || new Date(message.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const bubble = document.createElement('p'); bubble.className = 'bubble'; bubble.textContent = message.text;
      meta.append(name, time); content.append(meta, bubble); row.append(avatar, content); $('messages').append(row);
    }
    if (nearBottom) requestAnimationFrame(() => { $('chat-body').scrollTop = $('chat-body').scrollHeight; });
  }
  function waiting(title, description, buttonText = 'Cancel search') {
    $('waiting-title').textContent = title; $('waiting-description').textContent = description; $('cancel-search').textContent = buttonText;
    $('waiting').hidden = false; $('conversation-start').hidden = true; $('messages').hidden = true; $('typing').hidden = true;
  }
  function showPreview() {
    if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
    state = null; view = 'preview'; pending = false; currentRoom = ''; messageSignature = '';
    previewMessages = sample.map(m => ({ ...m }));
    $('waiting').hidden = true; $('conversation-start').hidden = true; $('messages').hidden = false; $('typing').hidden = true;
    $('preview-notice').hidden = false; $('preview-notice-text').textContent = 'Interface preview · The conversation below is an example.'; $('reset-preview').hidden = false;
    $('people-count').textContent = 'Just the two of you'; $('copy-link').hidden = true; $('live-details').hidden = true;
    $('info-mode').textContent = "You're viewing a sample conversation. Messages you write in the preview stay in this window.";
    $('message-input').value = ''; resizeInput(); header('Example conversation', 'Take a look around');
    $('find-button').innerHTML = '<svg><use href="#i-plus"/></svg>Find someone to talk to';
    drawMessages(previewMessages); controls(); error('');
  }
  async function checkStatus() {
    try {
      const r = await fetch('/api/status'); if (!r.ok) throw new Error();
      const status = await r.json(); ready = status.ready;
      $('engine-status').textContent = status.mode === 'scripted' ? 'Rehearsal mode. Free text travels unchanged; preset phrases use fixed interpretations.' : `Local interpreter: ${status.model}. ${status.detail || ''}`;
      if (!ready) error('The conversation service is not ready yet. Check the connection details.');
      else if ($('send-error').textContent.startsWith('The conversation service')) error('');
    } catch { ready = false; $('engine-status').textContent = 'The local conversation server could not be reached.'; }
    controls();
  }
  function render(next) {
    state = next; currentRoom = next.room;
    view = next.paired ? 'live' : 'searching';
    $('preview-notice').hidden = next.mode !== 'scripted'; $('reset-preview').hidden = true;
    $('preview-notice-text').textContent = 'Rehearsal mode · You are chatting with the other connected participant.';
    $('live-details').hidden = false; $('room-label').textContent = `Room: ${next.room}`;
    $('info-mode').textContent = 'This conversation has two seats. Both people provide their own messages. Connection details are shown below.';
    $('copy-link').hidden = false; $('people-count').textContent = next.paired ? '2 participants' : '1 participant';
    $('find-button').innerHTML = '<svg><use href="#i-plus"/></svg>Start a new conversation';
    if (next.phase !== 'act1') {
      view = 'ended'; header('Conversation ended', 'Conversation ended');
      waiting('A moment to pause.', 'This part of the conversation has ended.', 'Start a new chat');
    } else if (!next.paired) {
      header('Waiting for someone', 'Looking for a connection');
      waiting(next.messages.length ? 'Connection paused.' : 'Looking for someone…', next.messages.length ? 'The other person has disconnected. You can wait here or start a new chat.' : 'Your conversation begins when another person joins.');
    } else {
      header(next.busy ? 'A message is on its way…' : 'Connected · Say hello', 'Connected now', true);
      $('waiting').hidden = true; $('conversation-start').hidden = next.messages.length > 0; $('messages').hidden = false;
      drawMessages(next.messages);
    }
    controls();
  }
  function roomLink() { const url = new URL(location.href); url.search = ''; url.searchParams.set('room', currentRoom); return url.href; }
  function connect(room, match = false) {
    error(''); $('room-error').textContent = '';
    if (socket) { socket.removeAllListeners(); socket.disconnect(); }
    state = null; pending = false; ready = false; messageSignature = ''; view = 'searching';
    $('messages').replaceChildren(); $('message-input').value = ''; resizeInput();
    $('preview-notice').hidden = true; header('Waiting for someone', 'Looking for a connection');
    waiting('Looking for someone…', 'Your conversation begins when another person joins.'); controls();
    if (staticPreview || !window.io) {
      $('preview-notice').hidden = false; $('preview-notice-text').textContent = 'Interface preview · No live participants are connected.'; $('reset-preview').hidden = false;
      $('waiting-description').textContent = 'This preview shows the waiting screen. Live pairing will happen in the connected version.';
      return;
    }
    const key = `between-us-seat:${room || 'match'}`;
    try { currentToken = params.has('new') || match ? token() : sessionStorage.getItem(key) || token(); sessionStorage.setItem(key, currentToken); }
    catch { currentToken = token(); }
    socket = io({ autoConnect: false });
    let joinedRoom = room;
    socket.on('connect', () => {
      const event = joinedRoom ? 'join' : 'match:find';
      socket.timeout(8000).emit(event, { room: joinedRoom, token: currentToken }, (err, result) => {
        if (err || !result?.ok) {
          $('room-error').textContent = result?.error || 'The connection could not be made. Please try again.';
          error($('room-error').textContent); return;
        }
        joinedRoom = result.room || joinedRoom; currentRoom = joinedRoom;
        try { sessionStorage.setItem(`between-us-seat:${joinedRoom}`, currentToken); history.replaceState({}, '', roomLink()); } catch {}
        checkStatus();
      });
    });
    socket.on('state', render);
    socket.on('typing', active => { $('typing').hidden = !active || view !== 'live'; });
    socket.on('disconnect', () => {
      if (state) state.paired = false;
      view = 'searching'; header('Connection paused', 'Reconnecting…'); $('typing').hidden = true;
      waiting('Connection paused.', 'Trying to reconnect. You can wait here or start a new chat.'); controls();
    });
    socket.on('connect_error', () => { error('The chat server could not be reached. Please try again.'); });
    socket.connect();
  }
  function send(text, phraseId) {
    if (!text.trim() || pending) return;
    error('');
    if (view === 'preview') {
      previewMessages.push({ id: `p${Date.now()}`, kind: 'sent', text, at: Date.now() });
      drawMessages(previewMessages); $('message-input').value = ''; resizeInput(); controls();
      $('chat-body').scrollTop = $('chat-body').scrollHeight;
      notify('Preview message added. No one else is connected.'); return;
    }
    if (view !== 'live' || !state?.paired || state.busy || !ready) return;
    pending = true; socket.emit('typing', false); controls();
    socket.timeout(100000).emit('message:send', phraseId ? { phraseId } : { text }, (err, result) => {
      pending = false;
      if (err || !result?.ok) error(result?.error || 'The message could not be sent. Please try again.');
      else { $('message-input').value = ''; resizeInput(); }
      controls();
    });
  }
  function resizeInput() {
    $('message-input').style.height = 'auto'; $('message-input').style.height = `${Math.min(105, $('message-input').scrollHeight)}px`;
    $('character-count').textContent = `${$('message-input').value.length} / 280`;
  }
  function end() {
    if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
    view = 'ended'; state = null;
    GestureInput.stop();
    header('Conversation ended', 'Ready for a fresh start');
    waiting('You left the conversation.', 'A new conversation is a new beginning.', 'Start a new chat');
    $('people-count').textContent = 'Not connected'; $('preview-notice').hidden = true; $('copy-link').hidden = true;
    controls();
  }
  $('find-button').addEventListener('click', () => connect('', true));
  $('cancel-search').addEventListener('click', () => { if (view === 'ended') connect('', true); else showPreview(); });
  $('end-button').addEventListener('click', end);
  $('reset-preview').addEventListener('click', showPreview);
  $('message-form').addEventListener('submit', e => { e.preventDefault(); send($('message-input').value.trim()); });
  $('message-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!$('send-button').disabled) send($('message-input').value.trim()); }
  });
  $('message-input').addEventListener('input', () => {
    resizeInput(); controls();
    if (socket?.connected && view === 'live') {
      socket.emit('typing', true); clearTimeout(typingTimer);
      typingTimer = setTimeout(() => socket?.connected && socket.emit('typing', false), 1300);
    }
  });
  document.querySelectorAll('[data-phrase]').forEach(b => b.addEventListener('click', () => send(quickPhrases[b.dataset.phrase], b.dataset.phrase)));
  $('join-form').addEventListener('submit', e => {
    e.preventDefault(); const value = $('room-input').value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,35}$/.test(value)) { $('room-error').textContent = 'Use 2–36 letters, numbers, or hyphens.'; return; }
    connect(value);
  });
  $('copy-link').addEventListener('click', async () => {
    if (!currentRoom) return;
    try { await navigator.clipboard.writeText(roomLink()); notify('Room link copied.'); }
    catch { notify(`Room code: ${currentRoom}`); }
  });
  $('info-button').addEventListener('click', () => $('info-dialog').showModal());
  $('close-info').addEventListener('click', () => $('info-dialog').close());
  $('close-info-bottom').addEventListener('click', () => $('info-dialog').close());
  $('refresh-status').addEventListener('click', checkStatus);
  $('camera-toggle').addEventListener('click', () => GestureInput.toggle({ onPoint: () => {}, onStatus: text => { $('input-help').textContent = text; } }));
  showPreview();
  if (params.get('room') && !staticPreview) { $('room-input').value = params.get('room'); connect(params.get('room')); }
})();
