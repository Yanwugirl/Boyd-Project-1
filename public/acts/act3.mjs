import { useAimTheme, windowFrame, setTitle } from './aim-shell.mjs';

function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

const picture = `<svg viewBox="0 0 320 300" role="img" aria-label="Two people, a shared key, and a removable shell">
  <path class="a3-arch" d="M45 252V136a115 115 0 0 1 230 0v116"/>
  <path class="a3-floor" d="M22 254Q160 226 298 254M43 270Q160 245 277 270"/>
  <g class="a3-person a3-person-one"><circle cx="100" cy="158" r="15"/><path d="M75 219v-17a25 25 0 0 1 50 0v17M92 155h1m14 0h1M95 165q5 4 10 0"/></g>
  <g class="a3-person a3-person-two"><circle cx="220" cy="158" r="15"/><path d="M195 219v-17a25 25 0 0 1 50 0v17M212 155h1m14 0h1M215 165q5 4 10 0"/></g>
  <path class="a3-shell a3-shell-left" d="M220 127h-19q-10 0-10 10v35q0 11 12 11h17v-56Zm0 59h-18q-16 0-16 20v19h34v-39Z"/>
  <path class="a3-shell a3-shell-right" d="M220 127h19q10 0 10 10v35q0 11-12 11h-17v-56Zm0 59h18q16 0 16 20v19h-34v-39Z"/>
  <path class="a3-shell-visor" d="M204 153h32"/>
  <path class="a3-thread" d="M126 209Q160 178 194 209"/>
  <g class="a3-shared-key"><circle cx="160" cy="102" r="12"/><path d="M160 114v27m0-7h9m-9-7h6"/></g>
  <g class="a3-sparks"><circle cx="152" cy="190" r="2"/><circle cx="168" cy="182" r="2"/><circle cx="160" cy="168" r="1.5"/></g>
</svg>`;

export async function mount({ host, state: initial, emit }) {
  const aim = initial.role === 'human'; // only Player 1 gets the AIM look
  useAimTheme(initial.role);
  let state = initial, act = initial.act3;
  let serverBase = initial.serverTime || Date.now(), localBase = performance.now();
  let actionPending = false, sending = false, destroyed = false, reading = false;
  let introSignature = '', messageSignature = '', outbox = null;
  let readyTimer, typingTimer, remoteTypingTimer, lastTyping = -Infinity;
  const draftKey = `between-us:act3:${state.room}:${state.role}`;
  const root = node('section', 'act3-space');
  const garden = node('aside', 'a3-garden');
  garden.innerHTML = picture;
  const gardenLabel = node('span', 'a3-eyebrow', 'THE SAME TWO PEOPLE');
  const gardenTitle = node('h2', '', 'A little space\nto be heard.');
  const gardenCopy = node('p', 'a3-garden-copy', 'The key you found together is here.');
  const hand = node('button', 'a3-hand', 'Use my hand'); hand.type = 'button';
  garden.append(gardenLabel, gardenTitle, gardenCopy, hand);

  const main = node('div', 'a3-main');
  const intro = node('section', 'a3-intro');
  const chat = node('section', 'a3-chat'); chat.setAttribute('aria-label', 'Speak freely');
  const header = node('header', 'a3-chat-header');
  const titleGroup = node('div');
  const title = node('h1', '', 'The words are yours.');
  titleGroup.append(node('span', 'a3-eyebrow', 'III / A CONVERSATION'), title, node('p', '', 'Your words arrive as you write them.'));
  const finish = node('button', 'a3-finish', 'Close together'); finish.type = 'button'; finish.dataset.gesture = '';
  header.append(titleGroup, finish);
  const connection = node('div', 'a3-connection'); connection.setAttribute('role', 'status');
  const endNotice = node('section', 'a3-end-notice');
  endNotice.setAttribute('role', 'status'); endNotice.setAttribute('aria-live', 'polite');
  const endCopy = node('div'); const endTitle = node('h2'); const endDescription = node('p');
  endCopy.append(endTitle, endDescription);
  const endAction = node('button'); endAction.type = 'button'; endAction.dataset.gesture = '';
  endNotice.append(endCopy, endAction);
  const log = node('div', 'a3-messages');
  log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite'); log.setAttribute('aria-label', 'Your conversation');
  const empty = node('div', 'a3-empty'); empty.append(node('span', '', '“'), node('h2', '', 'What did you want to say?'), node('p', '', 'There is room for your own words here.'));
  const newMessages = node('button', 'a3-new-messages', 'New messages ↓'); newMessages.type = 'button'; newMessages.hidden = true;
  const remoteTyping = node('p', 'a3-typing'); remoteTyping.setAttribute('role', 'status');
  const form = node('form', 'a3-compose');
  const inputLabel = node('label', 'sr-only', 'Your words'); inputLabel.htmlFor = 'act3-message';
  const input = node('textarea'); input.id = 'act3-message'; input.rows = 2; input.maxLength = 2000;
  input.placeholder = 'Write what you want to say…';
  const send = node('button', 'a3-send', 'Send ↑'); send.type = 'submit'; send.dataset.gesture = '';
  send.setAttribute('aria-label', 'Send your words');
  const inputRow = node('div', 'a3-input-row'); inputRow.append(inputLabel, input, send);
  const meta = node('div', 'a3-input-meta');
  const help = node('span', '', 'Enter to send · Shift + Enter for a new line');
  const count = node('span', '', '0 / 2000'); meta.append(help, count);
  const status = node('p', 'a3-send-status'); status.setAttribute('role', 'status');
  form.append(inputRow, meta, status);
  chat.append(header, connection, endNotice, log, newMessages, remoteTyping, form);

  const ending = node('section', 'a3-ending');
  ending.append(node('span', 'a3-eyebrow', 'THREE ACTS / COMPLETED TOGETHER'), node('h1', '', 'Until next time.'), node('p', 'a3-ending-description', 'The conversation ends here because you both chose to close it.'));
  const finalWords = node('div', 'a3-final-words');
  const endingActions = node('div', 'a3-ending-actions');
  const read = node('button', 'a3-primary', 'Read our conversation'); read.type = 'button'; read.dataset.gesture = '';
  const leave = node('a', 'a3-return', 'Return to the beginning'); leave.href = '/';
  endingActions.append(read, leave); ending.append(finalWords, endingActions);
  main.append(intro, chat, ending);
  const mainWindow = aim ? windowFrame('You : The other person - Instant Message', main, 'aim-main') : null;
  root.append(aim ? windowFrame('Buddy Info', garden, 'aim-side') : garden, aim ? mainWindow : main); host.append(root);

  try {
    const saved = JSON.parse(sessionStorage.getItem(draftKey));
    if (typeof saved?.text === 'string') input.value = saved.text.slice(0, 2000);
    if (saved?.outbox?.text === input.value && typeof saved.outbox.id === 'string') outbox = saved.outbox;
  } catch {}
  function saveDraft() {
    try { sessionStorage.setItem(draftKey, JSON.stringify({ text: input.value, outbox })); } catch {}
  }
  function now() { return serverBase + performance.now() - localBase; }
  function isOpen() { return act?.step === 'conversation' && now() >= act.readyAt; }
  function scrollToBottom() { log.scrollTop = log.scrollHeight; newMessages.hidden = true; }
  function stopTyping() {
    clearTimeout(typingTimer);
    emit('act3:typing', false);
  }
  function completeSend(id, text) {
    if (outbox?.id !== id) return;
    if (input.value === text) input.value = '';
    outbox = null; sending = false; status.textContent = ''; saveDraft(); controls();
  }
  function controls() {
    const complete = act?.step === 'complete';
    const open = isOpen();
    input.disabled = !open;
    send.disabled = !open || !state.paired || sending || !input.value.trim() || input.value.length > 2000;
    send.textContent = sending ? 'Sending…' : 'Send ↑';
    count.textContent = `${input.value.length} / 2000`;
    finish.disabled = !open || !state.paired || actionPending || sending || Boolean(act?.endReady[state.role]);
    finish.textContent = complete && reading ? 'Back to the ending' : 'Close together';
    if (complete && reading) finish.disabled = false;
    connection.hidden = complete || state.paired;
    connection.textContent = 'Your partner is reconnecting. You can keep your words here until they return.';
    const meReady = Boolean(act?.endReady[state.role]);
    const otherReady = Boolean(act?.endReady[state.role === 'human' ? 'robot' : 'human']);
    endNotice.hidden = !open || (!meReady && !otherReady);
    endTitle.textContent = meReady ? 'You’re ready to close this conversation.' : 'Your partner is ready to close together.';
    endDescription.textContent = meReady ? 'They have been notified. You can keep talking or cancel your request.' : 'Take the time you need. The conversation closes when you both choose.';
    endAction.textContent = meReady ? 'Keep talking' : 'Close together';
    endAction.disabled = !state.paired || actionPending || sending;
  }
  function action(data) {
    if (actionPending || !state.paired) return;
    actionPending = true; introSignature = ''; render();
    emit('act3:action', data, result => {
      actionPending = false;
      if (!result?.ok) status.textContent = result?.error || 'Please try your choice again.';
      introSignature = ''; render();
    });
  }
  function introButton(label, data, secondary = false, disabled = false) {
    const button = node('button', secondary ? 'a3-secondary' : 'a3-primary', label);
    button.type = 'button'; button.dataset.gesture = '';
    button.disabled = disabled || actionPending || !state.paired;
    button.addEventListener('click', () => action(data));
    return button;
  }
  function renderIntro() {
    const signature = JSON.stringify([act?.invited, act?.requested, act?.moreTime, state.paired, state.role, actionPending]);
    if (signature === introSignature) return;
    introSignature = signature;
    intro.replaceChildren(node('span', 'a3-eyebrow', 'III / THE KEY YOU FOUND TOGETHER'), node('h1', '', 'An invitation,\nthen a choice.'));
    const mine = state.role === 'human';
    const description = mine
      ? 'You have the shared key. Offer it when you are ready. The person inside the shell chooses when to open it.'
      : 'Your partner can offer the shared key. You choose whether you are ready to open this space together.';
    intro.append(node('p', 'a3-intro-copy', description));
    if (!state.paired) intro.append(node('p', 'a3-invitation', 'Your partner is reconnecting. The key stays here.'));
    if (act?.moreTime) intro.append(node('p', 'a3-invitation', mine ? 'Your partner asked for a little more time.' : 'Take your time. The key can be offered again when you are ready.'));
    if (mine) {
      if (act?.requested && !act.invited) intro.append(node('p', 'a3-invitation', 'Your partner is ready to receive the key.'));
      if (act?.invited) {
        intro.append(node('p', 'a3-invitation', 'The key is offered. Your partner can take their time.'), introButton('Keep the key here for now', { type: 'offer-key', value: false }, true));
      } else intro.append(introButton('Offer the shared key', { type: 'offer-key', value: true }));
    } else if (act?.invited) {
      intro.append(node('p', 'a3-invitation', 'Your partner is offering the shared key.'), introButton('Open the space together', { type: 'accept-key' }), introButton('I need a little more time', { type: 'more-time' }, true));
    } else {
      intro.append(introButton(act?.requested ? 'Your partner has been notified…' : 'Ask for the shared key', { type: 'request-key' }, false, act?.requested));
    }
    const error = node('p', 'a3-intro-status', status.textContent); error.setAttribute('role', 'status'); intro.append(error);
  }
  function renderMessages() {
    const messages = act?.messages || [];
    const signature = messages.map(message => message.id).join(',');
    if (signature === messageSignature && log.childNodes.length) return;
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 90;
    const first = !messageSignature;
    messageSignature = signature;
    empty.hidden = messages.length > 0;
    if (!empty.parentNode) log.prepend(empty);
    const ids = new Set(messages.map(message => message.id));
    for (const row of log.querySelectorAll('[data-message-id]')) if (!ids.has(row.dataset.messageId)) row.remove();
    const existing = new Set([...log.querySelectorAll('[data-message-id]')].map(row => row.dataset.messageId));
    for (const message of messages) {
      if (existing.has(message.id)) continue;
      const mine = message.from === state.role;
      const row = node('article', `a3-message ${mine ? 'mine' : 'theirs'}`); row.dataset.messageId = message.id;
      const heading = node('div', 'a3-message-meta');
      const time = new Date(message.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      heading.append(node('span', '', mine ? 'You' : 'The other person'), node('time', '', time));
      row.append(heading, node('p', 'a3-bubble', message.text));
      if (message.translation) row.append(node('p', 'a3-translation', `English: ${message.translation}`));
      if (mine) row.append(node('small', 'a3-sent', 'Sent ✓'));
      log.append(row);
    }
    if (first || nearBottom) requestAnimationFrame(scrollToBottom);
    else newMessages.hidden = false;
  }
  function renderEnding() {
    finalWords.replaceChildren();
    for (const role of ['human', 'robot']) {
      const message = [...act.messages].reverse().find(item => item.from === role);
      if (!message) continue;
      const card = node('blockquote');
      card.append(node('p', '', message.text), node('cite', '', role === state.role ? 'Your last words' : 'Their last words'));
      finalWords.append(card);
    }
    read.hidden = act.messages.length === 0;
  }
  function render() {
    if (destroyed) return;
    if (!act) { intro.textContent = 'Your shared key is arriving…'; chat.hidden = true; ending.hidden = true; return; }
    const sealed = act.step === 'sealed';
    const complete = act.step === 'complete';
    root.classList.toggle('is-open', !sealed);
    root.classList.toggle('is-complete', complete);
    if (aim) setTitle(mainWindow, sealed ? 'Shared Key - File Transfer' : complete ? 'You : The other person - Signed Off' : 'You : The other person - Instant Message');
    intro.hidden = !sealed; chat.hidden = sealed || (complete && !reading); ending.hidden = !complete || reading;
    form.hidden = complete;
    gardenTitle.textContent = sealed ? 'A little space\nto be heard.' : complete ? 'The words\nwere yours.' : 'Two people.\nTheir own words.';
    gardenCopy.textContent = sealed ? 'The key you found together is here.' : 'The same connection. A little more room for each other.';
    if (sealed) renderIntro();
    else {
      renderMessages();
      if (complete) {
        renderEnding(); document.title = 'Between Us · Until next time'; remoteTyping.textContent = '';
      }
    }
    if (!state.paired) { remoteTyping.textContent = ''; clearTimeout(remoteTypingTimer); }
    controls();
    clearTimeout(readyTimer);
    if (act.step === 'conversation' && !isOpen()) readyTimer = setTimeout(controls, Math.max(0, act.readyAt - now()) + 25);
    if (outbox && act.messages.some(message => message.clientId === outbox.id && message.from === state.role)) completeSend(outbox.id, outbox.text);
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (send.disabled) return;
    if (!outbox || outbox.text !== input.value) {
      outbox = { id: Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join(''), text: input.value };
    }
    const current = { ...outbox };
    sending = true; status.textContent = 'Sending your words…'; saveDraft(); stopTyping(); controls();
    emit('act3:send', { clientId: current.id, text: current.text }, result => {
      if (destroyed || outbox?.id !== current.id) return;
      if (result?.ok) completeSend(current.id, current.text);
      else { sending = false; status.textContent = result?.error || 'Your words are still here. Try sending again.'; controls(); }
    });
  });
  input.addEventListener('input', () => {
    saveDraft(); controls();
    if (!isOpen() || !state.paired) return;
    const time = performance.now();
    if (time - lastTyping > 300) { emit('act3:typing', true); lastTyping = time; }
    clearTimeout(typingTimer); typingTimer = setTimeout(stopTyping, 1400);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault(); if (!send.disabled) form.requestSubmit();
    }
  });
  input.addEventListener('blur', stopTyping);
  finish.addEventListener('click', () => {
    if (act?.step === 'complete') { reading = false; render(); return; }
    action({ type: 'finish', value: true });
  });
  endAction.addEventListener('click', () => action({ type: 'finish', value: !act.endReady[state.role] }));
  read.addEventListener('click', () => { reading = true; render(); requestAnimationFrame(scrollToBottom); });
  newMessages.addEventListener('click', scrollToBottom);
  hand.addEventListener('click', () => GestureInput.toggle({
    onPoint() {}, instructions: 'Hold over a button for 1.5 seconds to choose. You can type your own words in the conversation.',
    onStatus: message => {
      status.textContent = message;
      hand.textContent = GestureInput.active ? 'Pause hand' : 'Use my hand';
      introSignature = ''; render();
    }
  }));
  render();
  return {
    update(next) {
      state = next; act = next.act3; serverBase = next.serverTime; localBase = performance.now(); render();
    },
    updateStage(packet) {
      if (!packet.typing || packet.typing.role === state.role) return;
      clearTimeout(remoteTypingTimer);
      remoteTyping.textContent = packet.typing.active && state.paired && act?.step === 'conversation' ? 'The other person is writing…' : '';
      if (remoteTyping.textContent) remoteTypingTimer = setTimeout(() => { remoteTyping.textContent = ''; }, 2800);
    },
    destroy() {
      destroyed = true; saveDraft(); stopTyping(); GestureInput.stop();
      clearTimeout(readyTimer); clearTimeout(typingTimer); clearTimeout(remoteTypingTimer); root.remove();
    }
  };
}
