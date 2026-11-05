// AIM-style skin for Act I of Between Us.
// Open as /aim.html?room=ROOMCODE&player=1 (copy ROOMCODE from the launcher's invitation link).
// It speaks the game's own socket protocol: join, state, message:send, typing, ready.

const W = 600, H = 440, LH = 18;
const ME = 'You';
const NAME_FONT = 'Times New Roman, serif';
const BODY_FONT = 'Arial, Helvetica, sans-serif';
const UI_FONT = 'Tahoma, Verdana, sans-serif';
const LOG = { x: 62, y: 58, w: W - 68, h: 190 };
const INPUT = { x: 62, y: 278, w: W - 68, h: 94 };
const SEND = { x: W - 76, y: 382, w: 68, h: 54 };
const CONT = { x: 385, y: 384, w: 62, h: 52 };

const params = new URLSearchParams(location.search);
const room = (params.get('room') || '').toLowerCase().trim();
const requestedPlayer = Number(params.get('player')) || undefined;

let socket, ta, typingTimer;
let state = null;        // the latest 'state' message from the server
let connected = false;
let joined = false;
let pending = '';        // text of a message that is still on its way
let readyPending = false;
let partnerTyping = false;
let lastError = '';
let scrollY = 0;
let lastCount = 0;
let handedOff = false;

// ---------- who is who ----------

const myRole = () => (state ? state.role : requestedPlayer === 2 ? 'robot' : 'human');
const partnerName = () => (myRole() === 'robot' ? 'Companion' : 'Someone');
const meP = () => state && state.players.find((p) => p && p.role === state.role);
const otherP = () => state && state.players.find((p) => p && p.role !== state.role);
const inAct1 = () => Boolean(state && state.paired && state.phase === 'act1');
const canSend = () => inAct1() && !state.busy && !pending;

function continueInfo() {
  const enabled = inAct1() && !state.busy && !pending && !readyPending &&
    state.players.every((p) => p && p.connected && p.sent >= 2);
  const mine = Boolean(meP() && meP().ready);
  const invited = Boolean(otherP() && otherP().ready) && !mine;
  return { enabled, mine, invited, label: mine ? 'Cancel' : 'Continue' };
}

// ---------- setup and networking ----------

function setup() {
  document.body.style.cssText = 'margin:0;background:#3a6ea5';
  const wrap = createDiv();
  wrap.style('position', 'relative');
  wrap.style('width', W + 'px');
  wrap.style('height', H + 'px');
  wrap.style('margin', '24px auto');

  const cnv = createCanvas(W, H);
  cnv.parent(wrap);
  cnv.style('display', 'block');

  ta = createElement('textarea');
  ta.parent(wrap);
  ta.style('box-sizing', 'border-box');
  ta.style('border', '0');
  ta.style('outline', 'none');
  ta.style('resize', 'none');
  ta.style('padding', '6px');
  ta.style('background', '#ffffff');
  ta.style('font', '15px Arial, Helvetica, sans-serif');
  ta.attribute('maxlength', '280'); // the server accepts 1 to 280 characters
  ta.position(INPUT.x + 1, INPUT.y + 1);
  ta.size(INPUT.w - 2, INPUT.h - 2);
  ta.elt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { // Enter sends, Shift+Enter adds a new line
      e.preventDefault();
      send();
    }
  });
  ta.elt.addEventListener('input', onTyping);

  connect();
}

const newToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');

function connect() {
  if (!room) { lastError = 'Open this page from your invitation: /aim.html?room=ROOMCODE&player=1'; return; }
  if (!window.io) { lastError = 'Open this page from the game server, not as a file.'; return; }

  // Same key format as the game's own page, so the same seat is reused when the next act opens
  const key = `act1:${room}:player:${requestedPlayer || 'auto'}`;
  let token;
  try { token = localStorage.getItem(key) || newToken(); localStorage.setItem(key, token); }
  catch { token = newToken(); }

  socket = io({ autoConnect: false });

  socket.on('connect', () => {
    connected = true;
    socket.timeout(8000).emit('join', { room, token, player: requestedPlayer, requireExisting: true }, (err, result) => {
      if (err || !result || !result.ok) {
        lastError = (result && result.error) || 'Cannot join this room. Ask for a new invitation.';
        return;
      }
      joined = true;
      lastError = '';
      const assigned = result.role === 'human' ? 1 : 2;
      try {
        localStorage.setItem(`act1:${room}:player:${assigned}`, token);
        if (!requestedPlayer) localStorage.setItem(`act1:${room}:player:auto`, token);
      } catch {}
    });
  });

  socket.on('state', (next) => {
    state = next;
    if (next.messages.length !== lastCount) { lastCount = next.messages.length; scrollY = 0; }
    if (next.phase !== 'act1') handOff();
  });

  socket.on('typing', (active) => (partnerTyping = Boolean(active)));

  socket.on('disconnect', () => {
    connected = false; joined = false; partnerTyping = false;
    if (state) state.paired = false;
  });

  socket.on('connect_error', () => (lastError = 'The server could not be reached. Keep the terminal open.'));

  socket.connect();
}

// When Act I ends, hand this seat over to the game's own page, which opens Act II
function handOff() {
  if (handedOff) return;
  handedOff = true;
  const n = state.role === 'human' ? 1 : 2;
  socket.disconnect(); // free the seat before the next page joins with the same token
  setTimeout(() => { location.href = `/player${n}.html?room=${encodeURIComponent(room)}`; }, 400);
}

function onTyping() {
  if (!socket || !socket.connected || !inAct1()) return;
  socket.emit('typing', true);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.connected && socket.emit('typing', false), 1400);
}

function send() {
  const msg = ta.value().trim();
  if (!msg || !canSend() || !socket.connected) return;
  lastError = '';
  pending = msg;
  socket.emit('typing', false);
  // The server rewrites the message before delivering it, which can take a while with Ollama
  socket.timeout(125000).emit('message:send', { text: msg }, (err, result) => {
    pending = '';
    if (err || !result || !result.ok) lastError = (result && result.error) || 'Sending timed out. Check the connection and try again.';
    else ta.value('');
  });
  ta.elt.focus();
}

function toggleContinue() {
  const info = continueInfo();
  if (!info.enabled) return;
  readyPending = true;
  socket.timeout(8000).emit('ready', !info.mine, (err, result) => {
    readyPending = false;
    if (err || !result || !result.ok) lastError = (result && result.error) || 'Your confirmation could not be sent.';
  });
}

// ---------- input ----------

const over = (r) => mouseX > r.x && mouseX < r.x + r.w && mouseY > r.y && mouseY < r.y + r.h;

function mousePressed() {
  if (over(SEND)) send();
  if (over(CONT)) toggleContinue();
}

function mouseWheel(e) {
  if (over(LOG)) {
    scrollY -= e.delta;
    return false;
  }
}

// ---------- drawing ----------

function draw() {
  const locked = !inAct1();
  if (ta.elt.disabled !== locked) ta.elt.disabled = locked;

  background('#ece9d8');
  drawTitleBar();
  drawMenuBar();
  drawBuddyIcon(6, 58, 190, myRole() === 'robot' ? 'bot' : 'someone');
  drawBuddyIcon(6, 254, 118, 'me');
  drawLog();
  drawToolbar();
  sunken(INPUT.x, INPUT.y, INPUT.w, INPUT.h, '#fff');
  drawBottomBar();

  push();
  noFill(); stroke('#0a3ca8'); strokeWeight(2);
  rect(1, 1, W - 2, H - 2);
  pop();

  cursor((over(SEND) && canSend()) || (over(CONT) && continueInfo().enabled) ? HAND : ARROW);
}

function statusNote() {
  if (!room) return '';
  if (!connected) return 'Connecting…';
  if (!joined || !state) return lastError ? '' : 'Joining the room…';
  if (state.phase !== 'act1') return 'Opening the next space…';
  if (!state.paired) return `Waiting for ${partnerName()} to sign on…`;
  const info = continueInfo();
  if (info.mine) return `Waiting for ${partnerName()} to continue. Press Cancel to keep chatting.`;
  if (info.invited) return `${partnerName()} is ready to continue. Press Continue to join them.`;
  if (state.busy) return 'A message is on its way…';
  if (info.enabled) return 'When you are both ready, press Continue.';
  return state.messages.length ? '' : 'Say hello.';
}

function buildEntries() {
  const out = [];
  if (state) state.messages.forEach((m) => out.push({ mine: m.kind === 'sent', text: m.text }));
  if (pending) out.push({ mine: true, text: pending, pending: true });
  const note = statusNote();
  if (note) out.push({ note });
  if (partnerTyping && inAct1()) out.push({ note: `${partnerName()} is typing…` });
  if (lastError) out.push({ note: lastError, error: true });
  return out;
}

function layoutEntry(e) {
  push();
  textSize(15);
  let out;
  if (e.note) {
    textFont(BODY_FONT); textStyle('italic');
    out = { note: true, error: e.error, lines: wrapText(e.note, LOG.w - 16, 0) };
  } else {
    textFont(NAME_FONT); textStyle('bold');
    const label = (e.mine ? ME : partnerName()) + ':';
    const nameW = textWidth(label + ' ');
    textFont(BODY_FONT); textStyle('normal');
    const lines = [];
    String(e.text || '').split('\n').forEach((para, i) => {
      lines.push(...wrapText(para, LOG.w - 16, i === 0 ? nameW : 0));
    });
    out = { label, nameW, mine: e.mine, pending: e.pending, lines };
  }
  pop();
  return out;
}

function drawLog() {
  sunken(LOG.x, LOG.y, LOG.w, LOG.h, '#fff');

  const items = buildEntries().map(layoutEntry);
  const total = items.reduce((sum, it) => sum + it.lines.length * LH, 0);
  const maxScroll = max(0, total - (LOG.h - 12));
  scrollY = constrain(scrollY, 0, maxScroll);
  let y = LOG.y + 6 - (maxScroll - scrollY);

  push();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(LOG.x + 2, LOG.y + 2, LOG.w - 4, LOG.h - 4);
  drawingContext.clip();

  noStroke();
  textAlign(LEFT, TOP);
  textSize(15);
  for (const it of items) {
    if (it.note) {
      textFont(BODY_FONT); textStyle('italic');
      fill(it.error ? '#c00000' : '#808080');
      it.lines.forEach((line, j) => text(line, LOG.x + 8, y + j * LH));
    } else {
      textFont(NAME_FONT); textStyle('bold');
      fill(it.mine ? '#0000e0' : '#d00000'); // you = blue, your partner = red
      text(it.label, LOG.x + 8, y);
      textFont(BODY_FONT); textStyle('normal');
      fill(it.pending ? '#808080' : 0);
      it.lines.forEach((line, j) => text(line, LOG.x + 8 + (j === 0 ? it.nameW : 0), y + j * LH));
    }
    y += it.lines.length * LH;
  }

  drawingContext.restore();
  pop();
}

// Splits one paragraph into lines; the first line has less room if a name sits in front of it
function wrapText(str, maxW, firstOffset) {
  const lines = [];
  let line = '';
  let limit = maxW - firstOffset;
  for (const word of str.replace(/(\S{30})/g, '$1 ').split(' ')) {
    const test = line ? line + ' ' + word : word;
    if (textWidth(test) > limit && line) {
      lines.push(line);
      line = word;
      limit = maxW;
    } else {
      line = test;
    }
  }
  lines.push(line);
  return lines;
}

// ---------- window chrome ----------

function sunken(x, y, w, h, bg) {
  push();
  noStroke(); fill(bg); rect(x, y, w, h);
  stroke('#808080'); line(x, y, x + w, y); line(x, y, x, y + h);
  stroke('#ffffff'); line(x, y + h, x + w, y + h); line(x + w, y, x + w, y + h);
  pop();
}

function drawTitleBar() {
  const g = drawingContext.createLinearGradient(0, 0, 0, 30);
  g.addColorStop(0, '#4a9bff');
  g.addColorStop(0.2, '#0a5be0');
  g.addColorStop(1, '#0640b8');
  drawingContext.fillStyle = g;
  drawingContext.fillRect(0, 0, W, 30);

  push();
  noStroke(); fill('#ffd23f'); rect(8, 7, 16, 16, 4);
  fill('#ffffff'); textFont(UI_FONT); textStyle('bold'); textSize(14); textAlign(LEFT, CENTER);
  text(`${ME} : ${partnerName()} - Instant Message`, 32, 15);

  for (let i = 0; i < 3; i++) { // minimise, maximise, close (decorative)
    const x = W - 3 * 26 - 4 + i * 26;
    fill(i === 2 ? '#d9471f' : '#2f6fe8'); stroke('#ffffff'); strokeWeight(1.5);
    rect(x, 4, 22, 22, 4);
    noFill(); strokeWeight(2);
    if (i === 0) line(x + 6, 19, x + 14, 19);
    if (i === 1) rect(x + 6, 8, 10, 10);
    if (i === 2) { line(x + 7, 9, x + 15, 17); line(x + 15, 9, x + 7, 17); }
  }
  pop();
}

function drawMenuBar() {
  push();
  fill(0); stroke(0); strokeWeight(1);
  textFont(UI_FONT); textStyle('normal'); textSize(13); textAlign(LEFT, CENTER);
  let x = 10;
  for (const item of ['File', 'Edit', 'Insert', 'People']) {
    noStroke(); text(item, x, 41);
    stroke(0); line(x, 49, x + textWidth(item[0]), 49);
    x += textWidth(item) + 18;
  }
  noStroke(); textAlign(RIGHT, CENTER);
  text('Warning Level: 0%', W - 10, 41);
  pop();
}

// Original placeholder artwork. The partner's icon depends on who is looking:
// Player 1 sees an ordinary person, Player 2 sees a companion.
function drawBuddyIcon(x, y, h, kind) {
  push();
  noStroke();
  fill(kind === 'me' ? '#9ad0f5' : '#bcd3f0'); rect(x, y, 50, h);
  fill('rgba(255,255,255,0.45)');
  for (let yy = y + 64; yy < y + h - 12; yy += 30) {
    ellipse(x + 14, yy, 9, 11);
    ellipse(x + 36, yy + 14, 9, 11);
  }
  if (kind === 'bot') {
    fill('#8fa3b8'); rect(x + 5, y + 8, 40, 36, 6);
    stroke('#8fa3b8'); strokeWeight(2); line(x + 25, y + 8, x + 25, y + 2); noStroke();
    fill('#ffffff'); ellipse(x + 17, y + 24, 12); ellipse(x + 33, y + 24, 12);
    fill('#1d2b3a'); ellipse(x + 17, y + 24, 5); ellipse(x + 33, y + 24, 5);
    rect(x + 16, y + 36, 18, 3, 1);
  } else if (kind === 'someone') {
    fill('#8fa3b8'); ellipse(x + 25, y + 20, 22);
    arc(x + 25, y + 48, 40, 38, PI, TWO_PI);
  } else {
    fill('#ffd23f'); ellipse(x + 25, y + 25, 42);
    fill('#1d2b3a'); ellipse(x + 18, y + 20, 5); ellipse(x + 32, y + 20, 5);
    noFill(); stroke('#1d2b3a'); strokeWeight(2); arc(x + 25, y + 28, 22, 14, 0, PI);
  }
  pop();
}

function drawToolbar() {
  push();
  const y = INPUT.y - 23;
  noStroke(); fill('#f4f2e8'); rect(INPUT.x, y, INPUT.w, 21);
  stroke('#aca899'); line(INPUT.x, y + 21, INPUT.x + INPUT.w, y + 21);

  textFont(BODY_FONT); textAlign(CENTER, CENTER);
  const tools = [
    ['A', '#0000dd', 'bold', 14], ['A', '#0000dd', 'bold', 14, 'box'], ['a', '#000000', 'normal', 11],
    ['A', '#000000', 'normal', 16], ['B', '#000000', 'bold', 14], ['I', '#000000', 'italic', 14],
    ['U', '#000000', 'normal', 14, 'ul'], ['link', '#0000dd', 'bold', 13, 'ul'],
  ];
  let x = INPUT.x + 14;
  for (const [t, col, style, size, deco] of tools) { // decorative
    textStyle(style); textSize(size);
    const w = textWidth(t);
    noStroke();
    if (deco === 'box') { fill('#0000dd'); rect(x - w / 2 - 3, y + 3, w + 6, 15, 2); fill('#ffffff'); }
    else fill(col);
    text(t, x, y + 11);
    if (deco === 'ul') { stroke(col); line(x - w / 2, y + 18, x + w / 2, y + 18); }
    x += w + 20;
  }
  fill('#ffd23f'); stroke('#a07000'); strokeWeight(1); ellipse(x, y + 11, 15);
  noStroke(); fill(0); ellipse(x - 3, y + 9, 2); ellipse(x + 3, y + 9, 2);
  noFill(); stroke(0); arc(x, y + 12, 9, 7, 0, PI);
  pop();
}

function drawBottomBar() {
  push();
  stroke('#aca899'); line(0, 378, W, 378); line(148, 384, 148, 436);
  noStroke(); textFont(UI_FONT); textStyle('normal'); textSize(12); textAlign(CENTER, CENTER);
  const items = [
    ['Warn', 40, 'warn'], ['Block', 100, 'block'], ['Expressions', 205, 'palette'],
    ['Games', 285, 'dice'], ['Video', 355, 'cam', true],
  ];
  for (const [name, cx, kind, off] of items) { // decorative
    drawIcon(kind, cx, 400, off);
    fill(off ? '#a0a0a0' : '#000000');
    text(name, cx, 424);
  }
  pop();
  drawContinue();
  drawSend();
}

// The "Continue" button replaces Talk: it sends the game's "ready" message
function drawContinue() {
  const info = continueInfo();
  const cx = CONT.x + CONT.w / 2;
  push();
  if (info.enabled && (over(CONT) || (info.invited && frameCount % 60 < 30))) {
    noFill(); stroke('#e0a030'); strokeWeight(2); rect(CONT.x, CONT.y, CONT.w, CONT.h, 6);
  }
  noStroke(); textFont(UI_FONT); textStyle('normal'); textSize(12); textAlign(CENTER, CENTER);
  drawIcon('talk', cx, 400, !info.enabled);
  fill(info.enabled ? '#000000' : '#a0a0a0');
  text(info.label, cx, 424);
  pop();
}

function drawIcon(kind, cx, cy, off) {
  const c = (hex) => (off ? '#b8b8b8' : hex);
  push();
  noStroke();
  if (kind === 'warn') {
    fill(c('#e03030'));
    beginShape();
    [[-4, -12], [8, -12], [1, -2], [8, -2], [-6, 13], [-1, 2], [-8, 2]].forEach(([dx, dy]) => vertex(cx + dx, cy + dy));
    endShape(CLOSE);
  } else if (kind === 'block') {
    noFill(); stroke(c('#d03030')); strokeWeight(3);
    ellipse(cx, cy, 24); line(cx - 8, cy - 8, cx + 8, cy + 8);
  } else if (kind === 'palette') {
    fill(c('#c98a3c')); ellipse(cx, cy + 2, 34, 24);
    fill('#d03030'); ellipse(cx - 8, cy, 6);
    fill('#3050d0'); ellipse(cx, cy - 3, 6);
    fill('#30a050'); ellipse(cx + 8, cy + 1, 6);
  } else if (kind === 'dice') {
    fill(c('#d03030')); rect(cx - 12, cy - 12, 24, 24, 5);
    fill('#ffffff'); ellipse(cx - 6, cy - 6, 5); ellipse(cx, cy, 5); ellipse(cx + 6, cy + 6, 5);
  } else if (kind === 'cam') {
    fill(c('#8a97a8')); ellipse(cx, cy, 26);
    fill(c('#d6dde6')); ellipse(cx, cy, 12);
  } else if (kind === 'talk') {
    fill(c('#8a97a8')); ellipse(cx, cy - 6, 12); arc(cx, cy + 13, 26, 26, PI, TWO_PI);
  }
  pop();
}

function drawSend() {
  const live = canSend();
  push();
  noStroke(); fill('#ece9d8'); rect(SEND.x, SEND.y, SEND.w, SEND.h, 6);
  if (live && over(SEND)) { noFill(); stroke('#e0a030'); strokeWeight(2); rect(SEND.x, SEND.y, SEND.w, SEND.h, 6); }
  fill('#ffffff'); stroke(live ? '#555555' : '#b0b0b0'); strokeWeight(1);
  rect(SEND.x + 20, SEND.y + 8, 28, 18, 2);
  line(SEND.x + 20, SEND.y + 8, SEND.x + 34, SEND.y + 20);
  line(SEND.x + 48, SEND.y + 8, SEND.x + 34, SEND.y + 20);
  noStroke(); fill(live ? '#555555' : '#a0a0a0'); textFont(UI_FONT); textStyle('bold'); textSize(13); textAlign(CENTER, CENTER);
  text('Send', SEND.x + SEND.w / 2, SEND.y + 40);
  pop();
}
