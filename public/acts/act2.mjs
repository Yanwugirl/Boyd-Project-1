const roleNames = { human: 'Player 1', robot: 'Player 2' };

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function mount({ host, state: initial, emit }) {
  const response = await fetch('/acts/act2-layout.json');
  if (!response.ok) throw new Error('The room could not load. Please try again.');
  const layout = await response.json();
  let state = initial;
  let positions = initial.journey.stage.positions;
  let game = initial.act2;
  let sketch, observer, lastSent = 0, signature = '', pending = false, closed = false;
  let lastKeyboardTick = 0;
  let handSpot = null, handSpotSince = 0, handSpotChosen = false;
  const keys = new Set();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  footer.append(hand, element('p', '', 'Click or drag on the floor to walk. Arrow keys also move. Hold your place when your partner needs you.'), notice);
  panel.append(progress, partnerNotice, content, footer);
  container.append(board, panel);
  host.append(container);

  function sendTarget(point) {
    const now = performance.now();
    if (closed || !state.paired || state.phase !== 'act2' || !game || !['gates', 'key'].includes(game.step) || now - lastSent < 80) return;
    lastSent = now;
    emit('scene:move', point);
  }
  function pointOnBoard(clientX, clientY) {
    const rect = board.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
    sendTarget({ x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height });
  }
  function pointer(event) {
    if (event.type === 'pointermove' && !event.buttons) return;
    pointOnBoard(event.clientX, event.clientY);
  }
  board.addEventListener('pointerdown', pointer);
  board.addEventListener('pointermove', pointer);
  function keyDown(event) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(event.key)) return;
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
      onPoint: point => {
        const x = point.x * innerWidth, y = point.y * innerHeight;
        const rect = board.getBoundingClientRect();
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
          handSpot = null; handSpotChosen = false; return;
        }
        const now = performance.now();
        if (!handSpot || Math.hypot(point.x - handSpot.x, point.y - handSpot.y) > .035) {
          handSpot = point; handSpotSince = now; handSpotChosen = false;
        }
        if (!handSpotChosen && now - handSpotSince >= 800) {
          handSpotChosen = true; pointOnBoard(x, y);
        }
      },
      onStatus: message => {
        handSpot = null; handSpotChosen = false;
        notice.textContent = message;
        hand.textContent = GestureInput.active ? 'Pause hand' : 'Use my hand';
      },
      instructions: 'Hold your finger over a floor spot to walk there. Hold over a button for 1.5 seconds to choose it.'
    });
  });

  function act(data) {
    if (pending || !state.paired) return;
    pending = true; signature = ''; render();
    emit('act2:action', data, result => {
      pending = false;
      if (!result?.ok) notice.textContent = result?.error || 'Please try that action again.';
      else notice.textContent = '';
      signature = ''; render();
    });
  }
  function button(text, data, disabled = false) {
    const node = element('button', 'act2-action', text);
    node.type = 'button'; node.disabled = disabled || pending || !state.paired;
    // Keep a single visible confirmation while the persistent request is shown.
    node.hidden = !partnerNotice.hidden && data.type === partnerChoice?.type;
    node.dataset.gesture = '';
    node.addEventListener('click', () => act(data));
    return node;
  }
  function heading(kicker, title, description) {
    content.append(element('span', 'act2-kicker', kicker), element('h1', '', title), element('p', 'act2-description', description));
  }
  const door = id => layout.doors.find(item => item.id === id);
  function renderPartnerNotice() {
    const other = state.role === 'human' ? 'robot' : 'human';
    const request = {
      arrival: { votes: game.seen, title: 'Your partner is ready to enter.', description: 'They chose to step into the space. Join them when you’re ready.', label: 'Step into the space', choice: { type: 'arrive' } },
      interlude: { votes: game.next, title: 'Your partner is ready to exchange roles.', description: 'They are waiting for your choice. Confirm below to trade places together.', label: 'I’m ready to exchange roles', choice: { type: 'next' } }
    }[game.step];
    const show = Boolean(state.paired && request?.votes[other] && !request.votes[state.role]);
    partnerNotice.hidden = !show;
    partnerChoice = show ? request.choice : null;
    if (!show) return;
    partnerTitle.textContent = request.title;
    partnerDescription.textContent = request.description;
    partnerConfirm.textContent = request.label;
    partnerConfirm.disabled = pending || !state.paired;
  }
  function render() {
    if (closed) return;
    if (!game) { content.replaceChildren(element('p', 'act2-description', 'The room is arriving…')); return; }
    const nextSignature = JSON.stringify({ ...game, keyHold: undefined, paired: state.paired, pending });
    if (nextSignature === signature) {
      const fill = content.querySelector('.act2-key-fill');
      if (fill) fill.style.width = `${Math.round(game.keyHold * 100)}%`;
      return;
    }
    signature = nextSignature;
    renderPartnerNotice();
    const stageIndex = { arrival: 0, gates: game.round + 1, interlude: 2, key: 3, threshold: 3 }[game.step];
    progress.replaceChildren();
    for (const [index, label] of ['Notice', 'Listen', 'Exchange', 'Together'].entries()) {
      const marker = element('span', index <= stageIndex ? 'active' : '', label);
      if (index === stageIndex) marker.setAttribute('aria-current', 'step');
      progress.append(marker);
    }
    content.replaceChildren();
    if (!state.paired) {
      content.append(element('div', 'act2-paused', 'Your partner is reconnecting. The room is holding your progress.'));
    }
    if (game.step === 'arrival') {
      const changed = state.reveal.some(message => message.original !== message.delivered);
      heading('I → II / THE SAME TWO PEOPLE', changed ? 'The words took a different path.' : 'Your words arrived as written.', changed
        ? 'You were speaking to each other. These are your real words, before and after their journey.'
        : 'You were speaking to each other. In this room, your messages arrived unchanged. Compare them before entering.');
      const archive = element('div', 'act2-archive');
      for (const message of state.reveal.slice(-4)) {
        const card = element('article', 'act2-message-card');
        card.append(element('small', '', `${roleNames[message.from]} wrote`), element('p', 'act2-original', message.original), element('small', '', 'The other person received'), element('p', 'act2-delivered', message.delivered));
        archive.append(card);
      }
      content.append(archive, button(game.seen[state.role] ? 'Waiting for your partner…' : 'Step into the space', { type: 'arrive' }, game.seen[state.role]));
      return;
    }
    if (game.step === 'interlude') {
      heading('ONE HALF FOUND', 'Now trade places.', 'One person found the way because the other stayed to listen. This time, let the other person lead.');
      content.append(element('div', 'act2-fragments', '◐   +   ◯'), button(game.next[state.role] ? 'Your partner is taking a moment…' : 'I’m ready to exchange roles', { type: 'next' }, game.next[state.role]));
      return;
    }
    if (game.step === 'key') {
      heading('TWO HALVES / ONE DOOR', 'Bring what you found.', 'Move your fragment into its matching circle at the doorway. Stay together until the two halves join.');
      const meter = element('div', 'act2-key-meter');
      const fill = element('div', 'act2-key-fill'); fill.style.width = `${game.keyHold * 100}%`;
      meter.append(fill);
      content.append(element('div', 'act2-fragments', '◐   +   ◑'), meter, element('p', 'act2-small', 'The warm circle belongs to Player 1. The cool circle belongs to Player 2.'));
      return;
    }
    if (game.step === 'threshold') {
      const mine = game.consent[state.role];
      const partner = game.consent[state.role === 'human' ? 'robot' : 'human'];
      heading('AT THE THRESHOLD', 'A key held by both.', partner && !mine
        ? 'Your partner is ready to carry this connection into the next space. Take your time, then choose together.'
        : 'Both fragments are here. The next door opens when each of you chooses to continue.');
      content.append(element('div', 'act2-fragments joined', '◉'), button(mine ? 'Keep this moment a little longer' : 'Continue together', { type: 'continue', value: !mine }));
      if (mine) content.append(element('p', 'act2-small', 'Your partner has been notified. Waiting for their choice.'));
      return;
    }
    const isGuide = state.role === game.guide;
    const round = layout.rounds[game.round];
    heading(`GATE ${game.round + 1} / ${isGuide ? 'YOU ARE THE GUIDE' : 'YOU ARE THE WALKER'}`, round.title, isGuide
      ? 'Stand in the listening circle. Only you can see the true mark. Send it to your partner and hold your place while they cross.'
      : 'Your partner can see the true mark. Ask for their original signal, then cross at that mark and reach the fragment on the far side.');
    const secret = door(game.clue);
    if (isGuide) {
      const clue = element('div', 'act2-clue');
      clue.append(element('span', 'act2-clue-symbol', secret?.glyph || '·'), element('p', '', secret ? `The true mark is the ${secret.name}.` : 'The mark appears when you stand inside the listening circle.'));
      content.append(clue);
      const signals = element('div', 'act2-signals');
      for (const mark of layout.doors) {
        const node = button(mark.glyph, { type: 'signal', symbol: mark.id }, !game.listening);
        node.setAttribute('aria-label', `Send ${mark.name} signal`);
        signals.append(node);
      }
      content.append(signals);
    }
    if (game.signal) {
      const original = door(game.signal.original), delivered = door(game.signal.delivered);
      const signal = element('div', 'act2-signal-message');
      if (game.signal.exact) {
        signal.append(element('small', '', 'ORIGINAL SIGNAL SHARED'), element('strong', '', `${original.glyph} ${original.name}`));
      } else {
        signal.append(element('small', '', isGuide ? `YOU SENT ${original.glyph} / THE ECHO DELIVERED` : 'THE ECHO DELIVERED'), element('strong', '', `${delivered.glyph} ${delivered.name}`), element('p', '', 'The echo shifts the mark. Ask for the original before crossing.'));
      }
      content.append(signal);
      if (game.signal.exact && game.listening && !game.passage) {
        content.append(element('p', 'act2-request', isGuide
          ? 'Check the true mark in your circle, then send it again.'
          : 'This mark did not open a passage. Your partner can check the clue and send it again.'));
      }
      if (!game.signal.exact) {
        if (isGuide && game.requested) {
          content.append(element('p', 'act2-request', 'Your partner is asking what you meant.'), button('Share my original signal', { type: 'share-original' }));
        } else if (!isGuide) {
          content.append(button(game.requested ? 'Waiting for their original…' : 'Ask for the original signal', { type: 'request-original' }, game.requested));
        }
      }
    } else if (!isGuide) {
      content.append(element('div', 'act2-clue', 'Your partner is finding the mark. Watch for their signal.'));
    }
    content.append(element('p', 'act2-small', game.listening ? 'The listening circle is held. The passage can stay open.' : 'The listening circle needs the guide’s presence.'));
  }

  await new Promise(resolve => {
    sketch = new p5(p => {
      const avatarPoints = structuredClone(positions);
      function glyph(mark, x, y, size, colour) {
        p.push(); p.stroke(colour); p.strokeWeight(1.5); p.noFill();
        if (mark === 'triangle') p.triangle(x, y - size, x - size, y + size * .75, x + size, y + size * .75);
        if (mark === 'circle') p.circle(x, y, size * 1.9);
        if (mark === 'wave') {
          for (const offset of [-3, 4]) p.bezier(x - size, y + offset, x - size * .3, y - size + offset, x + size * .3, y + size + offset, x + size, y + offset);
        }
        p.pop();
      }
      function ring(point, colour, label, active = false, radius = 34) {
        const x = point.x * p.width, y = point.y * p.height;
        p.noStroke(); p.fill(...colour, active ? 30 : 8); p.circle(x, y, radius * 2);
        p.noFill(); p.stroke(...colour, active ? 210 : 85); p.strokeWeight(active ? 2 : 1); p.circle(x, y, radius * 2);
        p.circle(x, y, radius * 1.55);
        p.noStroke(); p.fill(...colour, 195); p.textSize(9); p.textAlign(p.CENTER); p.text(label, x, y + radius + 17);
      }
      p.setup = () => {
        const canvas = p.createCanvas(Math.max(280, board.clientWidth), Math.max(260, board.clientHeight));
        canvas.elt.tabIndex = 0;
        canvas.elt.setAttribute('aria-label', 'Two-player room. Move across the floor to the listening circle, marked passages, and key fragments. Arrow keys also move your figure.');
        p.pixelDensity(Math.min(devicePixelRatio || 1, 2)); p.frameRate(30);
        observer = new ResizeObserver(() => p.resizeCanvas(Math.max(280, board.clientWidth), Math.max(260, board.clientHeight)));
        observer.observe(board); resolve();
      };
      p.draw = () => {
        const w = p.width, h = p.height, time = reduced ? 0 : p.millis() / 1000;
        const round = layout.rounds[game?.round || 0];
        const stage = game?.step || 'arrival';
        const inPuzzle = stage === 'gates' || stage === 'interlude';
        p.background('#192e29');
        p.noStroke();
        for (let layer = 9; layer >= 0; layer--) { p.fill(163, 195, 143, 2); p.ellipse(w * .5, h * .43, w * (.5 + layer * .07), h * (.6 + layer * .05)); }
        p.fill('#243c33'); p.stroke(186, 204, 160, 35); p.strokeWeight(1);
        p.rect(w * .055, h * .065, w * .89, h * .87, 25);
        p.stroke(184, 209, 170, 13);
        for (let column = 1; column < 18; column++) p.line(w * (.055 + column * .0495), h * .065, w * (.055 + column * .0495), h * .935);
        for (let row = 1; row < 12; row++) p.line(w * .055, h * (.065 + row * .0725), w * .945, h * (.065 + row * .0725));
        p.noFill(); p.stroke(218, 221, 181, 45); p.strokeWeight(1.2);
        p.bezier(w * .32, h * .065, w * .38, -h * .035, w * .62, -h * .035, w * .68, h * .065);
        if (inPuzzle) {
          p.noStroke(); p.fill('#152a25'); p.rect(w * .48, h * .09, w * .04, h * .82, 8);
          for (const mark of layout.doors) {
            const open = game?.passage === mark.id;
            p.fill(open ? '#506c51' : '#30473b');
            p.stroke(open ? '#dbd8a3' : '#819179'); p.strokeWeight(open ? 2 : 1);
            p.rect(w * .462, h * (mark.y - layout.doorHalfHeight), w * .076, h * layout.doorHalfHeight * 2, 7);
            glyph(mark.id, w * .5, h * mark.y, Math.min(w, h) * .018, open ? '#e9dfaa' : '#b8c7a5');
          }
          ring(round.pad, [171, 210, 193], game?.guide === state.role ? 'STAND HERE TO LISTEN' : 'YOUR PARTNER HOLDS THIS', game?.listening);
          ring(round.goal, game?.operator === 'human' ? [233, 210, 157] : [171, 210, 193], 'KEY FRAGMENT', false, 22);
          p.noStroke(); p.fill('#e4d8a5'); p.textSize(29); p.textAlign(p.CENTER); p.text(game?.round === 0 ? '◐' : '◑', round.goal.x * w, round.goal.y * h + 10);
          if (game?.clue) glyph(game.clue, round.pad.x * w, round.pad.y * h - 5, 11, '#dce7c8');
        } else if (stage === 'key' || stage === 'threshold') {
          ring(layout.keySlots.human, [233, 210, 157], 'PLAYER 1', true, 28);
          ring(layout.keySlots.robot, [171, 210, 193], 'PLAYER 2', true, 28);
          p.noFill(); p.stroke('#c9d4b2'); p.strokeWeight(2);
          p.arc(w * .5, h * .16, w * .24, h * .22, p.PI, p.TWO_PI);
          p.line(w * .38, h * .16, w * .38, h * .33); p.line(w * .62, h * .16, w * .62, h * .33);
          if (stage === 'threshold') { p.noStroke(); p.fill('#e1d9ac'); p.circle(w * .5, h * .2, 19 + Math.sin(time) * 2); }
        } else {
          p.noStroke(); p.fill(210, 223, 188, 140); p.textFont('Georgia'); p.textAlign(p.CENTER); p.textSize(Math.min(30, w * .041));
          p.text('Another person was here all along.', w * .5, h * .28); p.textFont('Arial');
        }
        for (const role of ['human', 'robot']) {
          avatarPoints[role].x = p.lerp(avatarPoints[role].x, positions[role].x, .28);
          avatarPoints[role].y = p.lerp(avatarPoints[role].y, positions[role].y, .28);
        }
        const a = avatarPoints.human, b = avatarPoints.robot;
        p.noFill(); p.stroke(212, 221, 179, 40); p.strokeWeight(1);
        p.bezier(a.x * w, a.y * h, w * .42, (a.y + b.y) * h * .42, w * .58, (a.y + b.y) * h * .42, b.x * w, b.y * h);
        for (const role of ['human', 'robot']) {
          const point = avatarPoints[role], x = point.x * w, y = point.y * h;
          const colour = role === 'human' ? [234, 214, 166] : [175, 215, 199];
          p.noStroke(); p.fill(...colour, 9); p.ellipse(x, y + 14, 55, 18);
          p.fill(...colour, 14); p.circle(x, y, 45 + Math.sin(time * 1.4) * 2);
          p.stroke(...colour, 220); p.strokeWeight(1.4); p.noFill();
          if (role === 'robot') { p.rect(x - 9, y - 12, 18, 19, 5); p.line(x - 5, y - 4, x + 5, y - 4); }
          else { p.circle(x, y - 4, 15); p.arc(x, y + 15, 24, 18, p.PI, p.TWO_PI); }
          if (game?.collected[role]) { p.noStroke(); p.fill(...colour, 230); p.circle(x + 15, y - 14, 6); }
          p.noStroke(); p.fill(...colour, 200); p.textSize(10); p.textAlign(p.CENTER); p.text(role === state.role ? 'YOU' : roleNames[role], x, y + 34);
        }
        p.noStroke(); p.fill('#a5b99a'); p.textAlign(p.LEFT); p.textSize(10); p.text('A PLACE FOR TWO', w * .085, h * .895);
        if (performance.now() - lastKeyboardTick > 90 && keys.size) {
          lastKeyboardTick = performance.now();
          const point = positions[state.role];
          const dx = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
          const dy = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
          sendTarget({ x: point.x + dx * .07, y: point.y + dy * .07 });
        }
      };
    }, board);
  });
  render();
  return {
    update(next) { state = next; positions = next.journey.stage.positions; game = next.act2; render(); },
    updateStage(next) { positions = next.positions; if (next.game) game = next.game; render(); },
    destroy() {
      closed = true; GestureInput.stop(); observer?.disconnect(); sketch?.remove();
      board.removeEventListener('pointerdown', pointer); board.removeEventListener('pointermove', pointer);
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur);
      container.remove();
    }
  };
}
