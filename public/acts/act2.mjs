// Act II: The Filter Room.
// Each player is a light in the room, driven by the mouse or by an ml5 handPose fingertip.
// The writer of a message points at what they really wrote; the interface pulls their light
// towards a comforting reply whenever they move. The reader must recognise their partner's
// wavering light among the interface's perfectly calm one, and meet it at the same line.
import { useAimTheme, windowFrame, setTitle } from './aim-shell.mjs';

const roleNames = { human: 'Player 1', robot: 'Player 2' };
const BONES = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]];
const TIPS = [4, 8, 12, 16, 20];
const ACTIVE = ['round', 'restored', 'join', 'threshold'];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const round3 = value => Math.round(value * 1000) / 1000;
const shorten = (text, max = 150) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function useFilterStyles() {
  if (document.querySelector('link[data-act2-filter]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/acts/act2-filter.css?v=filter1'; link.dataset.act2Filter = '';
  document.head.append(link);
}

export async function mount({ host, state: initial, emit }) {
  const response = await fetch('/acts/act2-layout.json');
  if (!response.ok) throw new Error('The room could not load. Please try again.');
  const layout = await response.json();
  const aim = initial.role === 'human'; // only Player 1 gets the AIM look
  useAimTheme(initial.role);
  useFilterStyles();
  let state = initial;
  let game = initial.act2;
  let sketch, observer, signature = '', pending = false, closed = false;
  let myPointer = null, myHand = null, lastSent = 0, dirty = false, lastKeyboardTick = 0, lastHandAt = 0;
  const keys = new Set();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const me = initial.role;
  const partnerRole = me === 'human' ? 'robot' : 'human';

  // ---------- Layout ----------
  const container = element('section', 'act2-layout');
  const board = element('div', 'act2-board');
  const panel = element('aside', 'act2-panel');
  panel.setAttribute('aria-label', 'Your part in the shared room');
  const progress = element('div', 'act2-progress');
  progress.setAttribute('aria-label', 'Act II progress');
  const partnerNotice = element('section', 'act2-partner-notice');
  partnerNotice.hidden = true;
  partnerNotice.setAttribute('role', 'status');
  partnerNotice.setAttribute('aria-live', 'polite');
  partnerNotice.setAttribute('aria-atomic', 'true');
  const partnerCopy = element('div', 'act2-partner-copy');
  const partnerTitle = element('h2');
  const partnerDescription = element('p');
  partnerCopy.append(partnerTitle, partnerDescription);
  const partnerConfirm = element('button', 'act2-partner-confirm');
  partnerConfirm.type = 'button'; partnerConfirm.dataset.gesture = '';
  partnerNotice.append(element('span', 'act2-partner-mark', '↗'), partnerCopy, partnerConfirm);
  let partnerChoice = null;
  partnerConfirm.addEventListener('click', () => { if (partnerChoice) act(partnerChoice); });
  const content = element('div', 'act2-panel-content');
  const footer = element('div', 'act2-controls');
  const hand = element('button', 'act2-hand', 'Use my hand');
  hand.type = 'button';
  const notice = element('p', 'act2-notice');
  notice.setAttribute('role', 'status');
  footer.append(hand, element('p', '', 'Your index finger is your light in the room. The camera starts automatically; if it can’t see your hand, your mouse or arrow keys take over. Hand tracking needs graphics acceleration (GPU) turned on in the browser.'), notice);
  panel.append(progress, partnerNotice, content, footer);
  const dialogWindow = aim ? windowFrame('Away Message', panel, 'aim-dialog') : null;
  container.append(...(aim ? [windowFrame('Between Us - The Filter Room', board, 'aim-room'), dialogWindow] : [board, panel]));
  host.append(container);

  // ---------- Input: mouse, touch, keyboard, hand ----------
  function flush(force = false) {
    const now = performance.now();
    if (closed || !state.paired || state.phase !== 'act2' || !game || !ACTIVE.includes(game.step)) return;
    if (!myPointer || (!dirty && !force) || now - lastSent < 80) return;
    lastSent = now; dirty = false;
    emit('scene:move', {
      x: round3(myPointer.x), y: round3(myPointer.y),
      hand: myHand ? myHand.map(point => [round3(point.x), round3(point.y)]) : null
    });
  }
  // One pointer for hand and mouse: while the camera sees your hand, the light sits exactly under the
  // round hand cursor. Over the side panel it waits at the room's edge, and the hand cursor presses buttons there.
  function followHand() {
    const point = window.GestureInput?.point;
    if (!point) {
      if (myHand) { myHand = null; dirty = true; }
      return;
    }
    lastHandAt = performance.now();
    const rect = board.getBoundingClientRect();
    const toRoom = p => ({ x: (p.x * innerWidth - rect.left) / rect.width, y: (p.y * innerHeight - rect.top) / rect.height });
    setPointer(toRoom(point));
    myHand = null; // only the fingertip is used: the light itself, no hand outline
  }
  function setPointer(point) {
    myPointer = { x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) };
    dirty = true; flush();
  }
  function toBoard(viewportX, viewportY) {
    const rect = board.getBoundingClientRect();
    return { x: (viewportX - rect.left) / rect.width, y: (viewportY - rect.top) / rect.height };
  }
  function pointer(event) {
    // The hand leads while it is visible; the mouse takes over whenever the hand leaves the camera.
    if (GestureInput.active && performance.now() - lastHandAt < 1000) return;
    const point = toBoard(event.clientX, event.clientY);
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
    setPointer(point);
  }
  board.addEventListener('pointerdown', pointer);
  board.addEventListener('pointermove', pointer);
  function keyDown(event) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    if (document.activeElement?.matches('input,textarea,select')) return;
    keys.add(event.key); event.preventDefault();
  }
  function keyUp(event) { keys.delete(event.key); }
  function blur() { keys.clear(); }
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);

  hand.addEventListener('click', () => {
    GestureInput.toggle({
      // The light reads the hand every frame in the drawing loop (followHand), so nothing is needed here.
      onPoint: () => {},
      onStatus: message => {
        notice.textContent = message;
        hand.textContent = GestureInput.active ? 'Pause my hand' : 'Use my hand';
        if (!GestureInput.active) { myHand = null; lastHandAt = 0; dirty = true; flush(true); } // the mouse takes over at once
      },
      instructions: 'Your index finger is your light. Hold it still over a line. Hold over a button for 1.5 seconds to press it.'
    });
  });

  // ---------- Actions ----------
  function act(data) {
    if (pending || !state.paired) return;
    pending = true; signature = ''; render();
    emit('act2:action', data, result => {
      pending = false;
      notice.textContent = result?.ok ? '' : (result?.error || 'Please try that action again.');
      signature = ''; render();
    });
  }
  function button(text, data, disabled = false) {
    const node = element('button', 'act2-action', text);
    node.type = 'button'; node.disabled = disabled || pending || !state.paired;
    node.hidden = !partnerNotice.hidden && data.type === partnerChoice?.type;
    node.dataset.gesture = '';
    node.addEventListener('click', () => act(data));
    return node;
  }
  function heading(kicker, title, description) {
    content.append(element('span', 'act2-kicker', kicker), element('h1', '', title));
    if (description) content.append(element('p', 'act2-description', description));
  }
  function line(label, text, className = '') {
    const row = element('div', `a2f-line ${className}`.trim());
    row.append(element('small', '', label), element('p', '', text));
    return row;
  }
  function meter(className, label, caption) {
    const wrap = element('div', `a2f-meter ${className}`);
    const bar = element('div', 'a2f-meter-bar');
    bar.append(element('div', 'a2f-meter-fill'));
    wrap.append(element('small', 'a2f-meter-label', label), bar, element('p', 'a2f-meter-caption', caption || ''));
    return wrap;
  }

  function renderPartnerNotice() {
    const request = {
      arrival: { votes: game.seen, title: 'Your partner is ready to enter.', description: 'They chose to step into the room. Join them when you’re ready.', label: 'Step into the room', choice: { type: 'arrive' } },
      restored: { votes: game.next, title: 'Your partner is ready to move on.', description: 'Take the time you need with these words, then continue together.', label: game.round + 1 < game.total ? 'Next message' : 'Bring the key together', choice: { type: 'next' } }
    }[game.step];
    const show = Boolean(state.paired && request?.votes[partnerRole] && !request.votes[me]);
    partnerNotice.hidden = !show;
    partnerChoice = show ? request.choice : null;
    if (!show) return;
    partnerTitle.textContent = request.title;
    partnerDescription.textContent = request.description;
    partnerConfirm.textContent = request.label;
    partnerConfirm.disabled = pending || !state.paired;
  }

  // Values that change every frame are written straight into the meters, without rebuilding the panel.
  function updateLive() {
    if (!game) return;
    const set = (selector, fraction) => {
      const fill = content.querySelector(`${selector} .a2f-meter-fill`);
      if (fill) fill.style.width = `${Math.round(clamp(fraction, 0, 1) * 100)}%`;
    };
    set('.a2f-settle', game.settle || 0);
    set('.a2f-join', game.join || 0);
    const caption = content.querySelector('.a2f-settle .a2f-meter-caption');
    if (caption) caption.textContent = (game.settle || 0) > .98 ? 'Steady. Your light is where you put it.' : 'Moving… the interface is pulling your light.';
    const meet = content.querySelector('.a2f-meet');
    if (meet) {
      const lit = game.meet?.index !== null && game.meet?.index !== undefined && (game.meet.index === game.pin?.pinned || game.meet.index === game.phantom);
      meet.textContent = !myPointer ? 'Move your light into the room.'
        : game.meet?.index === null || game.meet?.index === undefined ? 'Your light is between the lines.'
          : lit ? 'Holding… stay where you are.' : 'No light is resting on this line yet.';
    }
  }

  function render() {
    if (closed) return;
    if (!game) { content.replaceChildren(element('p', 'act2-description', 'The room is arriving…')); return; }
    const nextSignature = JSON.stringify({
      step: game.step, round: game.round, total: game.total, seen: game.seen, next: game.next, consent: game.consent,
      attempts: game.attempts, outcome: game.outcome, restored: game.restored?.length, card: game.card,
      pinned: game.pin?.pinned ?? null, paired: state.paired, pending
    });
    if (nextSignature === signature) { updateLive(); return; }
    signature = nextSignature;
    const isWriter = game.writer === me;
    if (aim) setTitle(dialogWindow, { arrival: 'Away Message', round: isWriter ? 'Your Words' : 'Their Words', restored: 'Message Restored', join: 'Two Lights', threshold: 'Sign On Together' }[game.step] || 'Between Us');
    renderPartnerNotice();

    const labels = ['Notice', ...Array.from({ length: game.total || 0 }, (_, i) => `Line ${i + 1}`), 'Together'];
    const stageIndex = game.step === 'arrival' ? 0 : ['round', 'restored'].includes(game.step) ? game.round + 1 : labels.length - 1;
    progress.replaceChildren();
    for (const [index, label] of labels.entries()) {
      const marker = element('span', index <= stageIndex ? 'active' : '', label);
      if (index === stageIndex) marker.setAttribute('aria-current', 'step');
      progress.append(marker);
    }
    content.replaceChildren();
    if (!state.paired) content.append(element('div', 'act2-paused', 'Your partner is reconnecting. The room is holding your progress.'));

    if (game.step === 'arrival') {
      const changed = state.reveal.some(message => message.original !== message.delivered);
      heading('I → II / THE SAME TWO PEOPLE', changed ? 'The words took a different path.' : 'Your words arrived as written.', changed
        ? 'You were speaking to each other. These are your real words, before and after the interface handled them. In the next room, the interface is still there.'
        : 'You were speaking to each other. Compare your words before entering. In the next room, the interface is still there.');
      const archive = element('div', 'act2-archive');
      for (const message of state.reveal.slice(-4)) {
        const card = element('article', 'act2-message-card');
        const mine = message.from === me;
        if (aim) {
          const [first, second] = mine ? ['You:', 'They saw:'] : ['They wrote:', 'You saw:'];
          const said = element('p', 'act2-original'); said.append(element('b', mine ? 'aim-name me' : 'aim-name them', first), ` ${message.original}`);
          const got = element('p', 'act2-delivered'); got.append(element('b', mine ? 'aim-name them' : 'aim-name me', second), ` ${message.delivered}`);
          card.append(said, got);
        } else {
          card.append(element('small', '', `${roleNames[message.from]} wrote`), element('p', 'act2-original', message.original), element('small', '', 'The other person received'), element('p', 'act2-delivered', message.delivered));
        }
        archive.append(card);
      }
      content.append(archive, button(game.seen[me] ? 'Waiting for your partner…' : 'Step into the room', { type: 'arrive' }, game.seen[me]));
      return;
    }

    if (game.step === 'round') {
      const n = `MESSAGE ${game.round + 1} OF ${game.total}`;
      if (isWriter) {
        heading(`${n} · YOU WROTE THIS`, 'Show them what you meant.',
          'They only received the rewritten version, and the interface still edits anything you type. Use your light instead: point at your own sentence and hold still. Whenever you move, the interface pulls your light towards its own comforting reply.');
        content.append(line('You wrote', game.card.original, 'a2f-mine'), line('They received', game.card.delivered));
        content.append(meter('a2f-settle', 'YOUR LIGHT', ''));
        const pinned = game.pin?.pinned;
        content.append(element('p', 'a2f-status', pinned === game.mine
          ? 'Your light is resting on your sentence. Stay there until they meet you.'
          : pinned !== null && pinned !== undefined ? 'Your light has settled on a line that is not yours.' : 'Point at your sentence and hold still.'));
        if (game.attempts >= 2) content.append(element('p', 'a2f-hint', 'Try drawing a small circle first, so they can tell your light from the interface’s. Then hold still on your sentence.'));
      } else {
        heading(`${n} · YOU RECEIVED THIS`, 'Find what they meant.',
          'Two lights are in the room. One is your partner, pointing at the words they really wrote. The other is the interface: perfectly calm, always resting on its comforting reply. Words appear only where a light rests. Hold your own light on the line your partner chooses.');
        content.append(line('You received', game.card.delivered));
        content.append(element('p', 'a2f-status a2f-meet', ''));
        if (game.attempts >= 2) content.append(element('p', 'a2f-hint', 'Your partner’s light wavers like a hand. The interface’s light never does.'));
      }
      if (game.outcome?.type === 'smoothed') {
        content.append(element('p', 'a2f-outcome', `The interface answered for them: “${game.outcome.text}” That was not their sentence. Try again.`));
      } else if (game.outcome?.type === 'misread') {
        content.append(element('p', 'a2f-outcome', `“${shorten(game.outcome.text, 90)}” is not what they wrote. Try again.`));
      }
      updateLive();
      return;
    }

    if (game.step === 'restored') {
      const latest = game.restored[game.restored.length - 1];
      const mine = latest?.writer === me;
      heading(`MESSAGE ${game.round + 1} OF ${game.total} · RESTORED`, mine ? 'They have your words now.' : 'Now you can hear it.', '');
      if (latest) {
        content.append(
          line(mine ? 'You wrote' : 'They wrote', latest.original, 'a2f-mine'),
          line(mine ? 'They received' : 'You received', latest.delivered),
          line('The interface would have said', latest.comfort, 'a2f-comfort'));
      }
      const last = game.round + 1 >= game.total;
      content.append(button(game.next[me] ? 'Waiting for your partner…' : last ? 'Bring the key together' : 'Next message', { type: 'next' }, game.next[me]));
      return;
    }

    if (game.step === 'join') {
      heading(`${game.total} ${game.total === 1 ? 'LINE' : 'LINES'} · ONE KEY`, 'Bring your lights together.',
        'Move into the circle at the centre of the room. The key only forms while both of you stay there.');
      content.append(meter('a2f-join', 'THE KEY', 'Both lights in the circle.'));
      updateLive();
      return;
    }

    if (game.step === 'threshold') {
      const mineReady = game.consent[me];
      const partnerReady = game.consent[partnerRole];
      heading('AT THE THRESHOLD', 'A key held by both.', partnerReady && !mineReady
        ? 'Your partner is ready to carry this into the next space. Take your time, then choose together.'
        : 'These words found their way back. The next door opens when each of you chooses to continue.');
      const list = element('div', 'a2f-restored-list');
      for (const item of game.restored) list.append(line(item.writer === me ? 'You meant' : 'They meant', item.original, 'a2f-mine'));
      content.append(list, button(mineReady ? 'Keep this moment a little longer' : 'Continue together', { type: 'continue', value: !mineReady }));
      if (mineReady) content.append(element('p', 'act2-small', 'Your partner has been notified. Waiting for their choice.'));
    }
  }

  // ---------- Drawing ----------
  await new Promise(resolve => {
    sketch = new p5(p => {
      const theme = aim
        ? { bg: '#ece9d8', floor: [251, 251, 244], grid: [10, 60, 168, 18], card: [255, 255, 255], cardLine: [127, 157, 185], ink: [20, 30, 50], faint: [128, 128, 128], found: [47, 158, 68], font: 'Tahoma, Verdana, sans-serif', serif: 'Tahoma, Verdana, sans-serif', human: [214, 148, 24], robot: [10, 91, 224] }
        : { bg: '#192e29', floor: [36, 60, 51], grid: [184, 209, 170, 13], card: [44, 70, 59], cardLine: [129, 145, 121], ink: [226, 232, 210], faint: [150, 170, 140], found: [219, 216, 163], font: 'Arial, sans-serif', serif: 'Georgia, serif', human: [234, 214, 166], robot: [175, 215, 199] };
      const colourOf = role => theme[role];
      let weave;
      const trail = [];
      let lastWeave = { mine: null, partner: null };

      function makeWeave() {
        weave?.remove();
        weave = p.createGraphics(p.width, p.height);
        weave.pixelDensity(1);
        lastWeave = { mine: null, partner: null };
      }
      function drawWeave() {
        const time = p.frameCount * .01;
        weave.noStroke(); weave.fill(...theme.floor, 5); weave.rect(0, 0, weave.width, weave.height);
        const lights = { mine: myPointer, partner: game?.pointers?.partner };
        for (const key of ['mine', 'partner']) {
          const point = lights[key], before = lastWeave[key];
          if (point && before) {
            const role = key === 'mine' ? me : partnerRole;
            const wobble = (p.noise(point.x * 9, point.y * 9, time) - .5) * 14;
            weave.stroke(...colourOf(role), 55); weave.strokeWeight(1.2); weave.noFill();
            weave.line(before.x * p.width, before.y * p.height, point.x * p.width + wobble, point.y * p.height - wobble);
          }
          lastWeave[key] = point ? { ...point } : null;
        }
        p.image(weave, 0, 0);
      }

      function drawHand(points, colour, alpha) {
        if (!points || points.length !== 21) return;
        const time = reduced ? 0 : p.frameCount * .02;
        const xy = points.map(pt => (Array.isArray(pt) ? { x: pt[0] * p.width, y: pt[1] * p.height } : { x: pt.x * p.width, y: pt.y * p.height }));
        p.noFill();
        for (const [chain, bone] of BONES.entries()) {
          for (let pass = 0; pass < 2; pass++) {
            p.stroke(...colour, alpha * (pass ? .45 : 1)); p.strokeWeight(pass ? 1 : 1.8);
            p.beginShape();
            for (const index of bone) {
              const jitter = (p.noise(index * .7, chain + pass * 3, time) - .5) * (pass ? 6 : 3);
              const x = xy[index].x + jitter, y = xy[index].y - jitter;
              if (p.splineVertex) p.splineVertex(x, y); // p5 2.x (the version in public/vendor) renamed curveVertex
              else {
                p.curveVertex(x, y);
                if (index === bone[0] || index === bone[bone.length - 1]) p.curveVertex(x, y);
              }
            }
            p.endShape();
          }
        }
        p.noStroke(); p.fill(...colour, alpha);
        for (const tip of TIPS) p.circle(xy[tip].x, xy[tip].y, tip === 8 ? 7 : 4);
      }

      function drawLight(point, colour, { size = 20, alpha = 230, hollow = false } = {}) {
        if (!point) return;
        const x = point.x * p.width, y = point.y * p.height;
        p.noStroke();
        for (let ring = 3; ring >= 1; ring--) { p.fill(...colour, 18 * ring); p.circle(x, y, size * (1 + ring * .55)); }
        if (hollow) { p.noFill(); p.stroke(...colour, alpha); p.strokeWeight(1.5); p.circle(x, y, size * .7); }
        else { p.fill(...colour, alpha); p.circle(x, y, size * .55); }
      }

      function progressRing(x, y, radius, fraction, colour) {
        if (!fraction) return;
        p.noFill(); p.stroke(...colour, 230); p.strokeWeight(3);
        p.arc(x, y, radius * 2, radius * 2, -p.HALF_PI, -p.HALF_PI + p.TWO_PI * clamp(fraction, 0, 1));
      }

      function drawTerminals() {
        if (!game?.terminals) return;
        const tw = layout.terminal.w * p.width, th = layout.terminal.h * p.height;
        const writerColour = colourOf(game.writer);
        for (const [index, terminal] of game.terminals.entries()) {
          const spot = layout.terminals[index];
          const x = spot.x * p.width - tw / 2, y = spot.y * p.height - th / 2;
          const pinned = game.pin?.pinned === index;
          const phantom = game.step === 'round' && game.phantom === index;
          if (phantom) { p.noStroke(); p.fill(...writerColour, 16); p.rect(x - 8, y - 8, tw + 16, th + 16, 14); }
          p.fill(...theme.card, aim ? 255 : 235);
          p.stroke(...(terminal.found ? theme.found : pinned ? writerColour : theme.cardLine), terminal.found || pinned ? 255 : 150);
          p.strokeWeight(terminal.found || pinned ? 2.4 : 1);
          if (game.mine === index && game.step === 'round') p.drawingContext.setLineDash([6, 5]);
          p.rect(x, y, tw, th, aim ? 4 : 10);
          p.drawingContext.setLineDash([]);
          const pad = Math.max(10, tw * .07);
          p.noStroke();
          if (terminal.text) {
            const text = shorten(terminal.text);
            const cjk = /[\u3000-\u9fff\uac00-\ud7af]/.test(text);
            if (p.textWrap) p.textWrap(cjk ? p.CHAR : p.WORD);
            p.fill(...theme.ink, 235); p.textFont(theme.serif); p.textAlign(p.LEFT, p.TOP);
            p.textSize(clamp(Math.min(tw, th) * .085, 11, 17));
            p.text(text, x + pad, y + pad + 8, tw - pad * 2, th - pad * 2 - 8);
          } else {
            // A line that no light is resting on: the words are there, but unreadable.
            p.stroke(...theme.faint, 90); p.strokeWeight(1);
            for (let row = 0; row < 4; row++) {
              const ly = y + pad + 18 + row * 18;
              if (ly > y + th - pad) break;
              for (let dash = 0; dash < 6; dash++) {
                const lx = x + pad + dash * ((tw - pad * 2) / 6);
                p.line(lx, ly, lx + (tw - pad * 2) / 6 - 8, ly + (p.noise(row, dash) - .5) * 4);
              }
            }
          }
          p.noStroke(); p.textFont(theme.font); p.textSize(9); p.textAlign(p.LEFT, p.BOTTOM);
          p.fill(...(terminal.found ? theme.found : theme.faint), 220);
          const tag = terminal.found ? 'RESTORED' : game.mine === index && game.step === 'round' ? 'YOUR WORDS' : '';
          if (tag) p.text(tag, x + pad, y + th - 6);
          const cx = spot.x * p.width, top = y - 2;
          if (game.pin?.index === index && !pinned) progressRing(cx, top, 9, game.pin.progress, writerColour);
          if (pinned) { p.noStroke(); p.fill(...writerColour, 255); p.circle(cx, top, 10); }
          if (game.meet?.index === index && game.meet.progress > 0) progressRing(cx, y + th + 2, 12, game.meet.progress, colourOf(game.reader));
        }
      }

      function drawPhantom(time) {
        if (game?.step !== 'round' || game.phantom === undefined) return;
        const spot = layout.terminals[game.phantom];
        const orbit = layout.terminal.w * .16;
        const point = {
          x: spot.x + Math.cos(time * 1.1) * orbit,
          y: spot.y + Math.sin(time * 1.1) * orbit * .55 * (p.width / p.height)
        };
        drawLight(point, colourOf(game.writer), { size: 22 + Math.sin(time * 2) * 1.5 });
      }

      p.setup = () => {
        const canvas = p.createCanvas(Math.max(280, board.clientWidth), Math.max(260, board.clientHeight));
        canvas.elt.tabIndex = 0;
        canvas.elt.setAttribute('aria-label', 'The shared room. Your light follows your hand or mouse. Three lines wait in the room; hold your light still to rest it on one. Arrow keys also move your light.');
        p.pixelDensity(1); p.frameRate(30); // lighter drawing leaves time for hand tracking
        makeWeave();
        observer = new ResizeObserver(() => { p.resizeCanvas(Math.max(280, board.clientWidth), Math.max(260, board.clientHeight)); makeWeave(); });
        observer.observe(board); resolve();
      };

      p.draw = () => {
        const w = p.width, h = p.height, time = reduced ? 0 : p.millis() / 1000;
        const step = game?.step || 'arrival';
        p.background(theme.bg);
        p.noStroke(); p.fill(...theme.floor); p.rect(w * .03, h * .04, w * .94, h * .92, aim ? 4 : 22);
        p.stroke(...theme.grid); p.strokeWeight(1);
        for (let column = 1; column < 18; column++) p.line(w * (.03 + column * .052), h * .04, w * (.03 + column * .052), h * .96);
        for (let row = 1; row < 12; row++) p.line(w * .03, h * (.04 + row * .0767), w * .97, h * (.04 + row * .0767));
        if (ACTIVE.includes(step)) drawWeave();

        if (step === 'arrival') {
          p.noStroke(); p.fill(...theme.ink, 170); p.textFont(theme.serif); p.textAlign(p.CENTER, p.CENTER); p.textSize(Math.min(30, w * .041));
          p.text('Another person was here all along.', w * .5, h * .4);
          p.textFont(theme.font); p.textSize(11); p.fill(...theme.faint, 200);
          p.text('The interface is still in this room.', w * .5, h * .4 + 34);
        }
        if (step === 'round' || step === 'restored') { drawTerminals(); drawPhantom(time); }
        if (step === 'join' || step === 'threshold') {
          const ring = layout.joinRing, x = ring.x * w, y = ring.y * h, r = ring.r * Math.min(w, h) * 1.2;
          p.noFill(); p.stroke(...theme.cardLine, 160); p.strokeWeight(1.2); p.circle(x, y, r * 2); p.circle(x, y, r * 1.5);
          if (step === 'join') progressRing(x, y, r + 6, game.join, theme.found);
          else { p.noStroke(); p.fill(...theme.found, 230); p.circle(x, y, 22 + Math.sin(time) * 2); }
          p.noStroke(); p.fill(...theme.faint, 210); p.textFont(theme.font); p.textSize(10); p.textAlign(p.CENTER, p.TOP);
          p.text(step === 'join' ? 'BOTH LIGHTS HERE' : 'THE KEY IS WHOLE', x, y + r + 14);
          if (game.restored?.length) {
            p.textFont(theme.serif); p.textSize(Math.min(15, w * .02)); p.fill(...theme.ink, 160);
            game.restored.forEach((item, index) => p.text(`“${shorten(item.original, 70)}”`, x, h * .1 + index * 22));
          }
        }

        // Hands: the partner's outline arrives over the network; mine comes from my own camera.
        if (ACTIVE.includes(step)) {
          const partnerLight = game?.pointers?.partner;
          if (partnerLight) { trail.push({ ...partnerLight }); if (trail.length > 14) trail.shift(); } else trail.length = 0;
          p.noFill(); p.stroke(...colourOf(partnerRole), 70); p.strokeWeight(1.3);
          p.beginShape(); for (const point of trail) p.vertex(point.x * w, point.y * h); p.endShape();
          const writing = step === 'round' && game.writer === me;
          if (writing && myPointer && game.beam) {
            // The writer sees the pull: their own position, and where the interface has moved their light.
            // Your finger is the solid light. The ring shows where the interface is pulling it: what they see.
            p.stroke(...colourOf(me), 120); p.strokeWeight(1); p.drawingContext.setLineDash([4, 5]);
            p.line(myPointer.x * w, myPointer.y * h, game.beam.x * w, game.beam.y * h); p.drawingContext.setLineDash([]);
            drawLight(game.beam, colourOf(me), { size: 24, hollow: true, alpha: 210 });
            p.noStroke(); p.fill(...colourOf(me), 220); p.textFont(theme.font); p.textSize(9); p.textAlign(p.CENTER, p.TOP);
            if (Math.hypot(game.beam.x - myPointer.x, game.beam.y - myPointer.y) > .03) p.text('THEY SEE', game.beam.x * w, game.beam.y * h + 16);
            drawLight(myPointer, colourOf(me), { size: 20 });
          } else {
            drawLight(myPointer, colourOf(me), { size: 20 });
          }
          drawLight(partnerLight, colourOf(partnerRole), { size: 22 });
          p.noStroke(); p.textFont(theme.font); p.textSize(9); p.textAlign(p.CENTER, p.TOP);
          if (myPointer) { p.fill(...colourOf(me), 230); p.text('YOU', myPointer.x * w, myPointer.y * h + 16); }
        }
        p.noStroke(); p.fill(...theme.faint, 200); p.textFont(theme.font); p.textAlign(p.LEFT, p.BOTTOM); p.textSize(10);
        p.text('THE FILTER ROOM', w * .05, h * .945);

        if (performance.now() - lastKeyboardTick > 60 && keys.size) {
          lastKeyboardTick = performance.now();
          const point = myPointer || { x: .5, y: .75 };
          const dx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
          const dy = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
          setPointer({ x: point.x + dx * .02, y: point.y + dy * .02 });
        }
        followHand();
        flush();
      };
    }, board);
  });

  render();
  // Hand input is the main way to play: start the camera automatically. The mouse still works.
  (function startHand(tries = 0) {
    if (closed || !window.GestureInput || GestureInput.active || tries > 20) return;
    if (GestureInput.loading) { setTimeout(() => startHand(tries + 1), 500); return; }
    hand.click();
  })();
  return {
    update(next) { state = next; game = next.act2; render(); },
    updateStage(next) { if (next.game) game = next.game; render(); },
    destroy() {
      closed = true; GestureInput.stop(); observer?.disconnect(); sketch?.remove();
      board.removeEventListener('pointerdown', pointer); board.removeEventListener('pointermove', pointer);
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur);
      container.remove();
    }
  };
}
