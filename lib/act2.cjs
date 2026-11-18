'use strict';
// Act II: The Filter Room.
// Each round takes one real message from Act I. The person who WROTE it knows the original words.
// The person who RECEIVED it only saw the rewritten version. The interface still edits text,
// so the writer can only point. Moving makes the interface pull their light towards a comforting
// line; holding still lets their light settle on what they really wrote. The reader must meet
// that light at the same line. Neither player can restore a message alone.
const { randomInt } = require('node:crypto');
const layout = require('../public/acts/act2-layout.json');

const roles = ['human', 'robot'];
const other = role => (role === 'human' ? 'robot' : 'human');
const votes = () => ({ human: false, robot: false });
const both = values => roles.every(role => values[role]);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
// Lines that differ only in punctuation, spaces or case count as the same line.
const bare = text => String(text || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const same = (a, b) => bare(a) === bare(b);
const cjk = text => /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(String(text || ''));

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function insideTerminal(point, index, grow = 1) {
  const t = layout.terminals[index];
  return Boolean(point && t &&
    Math.abs(point.x - t.x) < (layout.terminal.w / 2) * grow &&
    Math.abs(point.y - t.y) < (layout.terminal.h / 2) * grow);
}
const terminalAt = point => layout.terminals.findIndex((_, index) => insideTerminal(point, index));

// Choose up to three of the room's real messages, alternating writers (Player 2 first), preferring lines the
// filter changed. Fewer messages means fewer rounds; nothing is made up.
function pickMessages(messages) {
  const usable = (Array.isArray(messages) ? messages : [])
    .filter(m => m && roles.includes(m.from) && typeof m.x === 'string' && typeof m.y === 'string');
  const changed = m => !same(m.y, m.xEn || m.x);
  const pools = {};
  for (const role of roles) {
    pools[role] = usable.filter(m => m.from === role)
      .sort((a, b) => Number(changed(b)) - Number(changed(a)) || (b.at || 0) - (a.at || 0));
  }
  const picked = [];
  for (const role of ['robot', 'human', 'robot', 'human']) {
    if (picked.length >= layout.maxRounds) break;
    const next = pools[role].shift();
    if (next) picked.push(next);
  }
  for (const role of roles) {
    while (picked.length < layout.maxRounds && pools[role].length) picked.push(pools[role].shift());
  }
  return picked;
}

function buildRound(message) {
  // The interface answers in the language the conversation used.
  const comforts = shuffle(cjk(message.x) && layout.comfortLinesZh ? layout.comfortLinesZh : layout.comfortLines);
  const readerOriginal = message.x; // shown in the language it was written in
  const options = [
    { kind: 'original', text: message.x, readerText: readerOriginal },
    same(message.y, readerOriginal)
      // Direct mode: nothing was rewritten, so a second comforting line takes the delivered slot.
      ? { kind: 'other', text: comforts[1], readerText: comforts[1] }
      : { kind: 'delivered', text: message.y, readerText: message.y },
    { kind: 'comfort', text: comforts[0], readerText: comforts[0] }
  ];
  const placed = shuffle(options);
  return {
    messageId: message.id || null,
    writer: message.from,
    reader: other(message.from),
    original: message.x,
    readerOriginal,
    delivered: message.y,
    comfort: comforts[0],
    options: placed,
    trueIndex: placed.findIndex(o => o.kind === 'original'),
    comfortIndex: placed.findIndex(o => o.kind === 'comfort')
  };
}

// After a new round or a failed attempt, each light must move before it counts again,
// so nobody restores (or fails) a line just because their pointer was already resting on it.
function freshHolds(game) {
  game.anchor = { human: game.pointers?.human ? { ...game.pointers.human } : null, robot: game.pointers?.robot ? { ...game.pointers.robot } : null };
  game.armed = votes();
  game.steady = 0; game.motion = 0; game.beam = null;
  game.pin = { index: null, ms: 0 }; game.pinned = null;
  game.meet = { index: null, ms: 0 };
}

function createAct2(positions, messages) {
  const game = {
    step: 'arrival', seen: votes(), next: votes(), consent: votes(), confirmed: false,
    positions, rounds: pickMessages(messages).map(buildRound), round: 0,
    pointers: { human: null, robot: null }, last: { human: null, robot: null },
    hands: { human: null, robot: null },
    outcome: null, restored: [], attempts: 0, join: 0, clock: 0
  };
  freshHolds(game);
  return game;
}

function beginRound(game, index) {
  game.step = 'round'; game.round = index; game.next = votes();
  game.outcome = null; game.attempts = 0;
  freshHolds(game);
}

// Called by server.cjs for every 'scene:move'. Stores the pointer and, if present, the hand outline.
function setTarget(game, role, data) {
  if (!game || !roles.includes(role) || !data) return;
  if (Number.isFinite(data.x) && Number.isFinite(data.y)) {
    game.pointers[role] = { x: clamp(data.x, 0, 1), y: clamp(data.y, 0, 1) };
  }
  if (data.hand === null) game.hands[role] = null;
  if (Array.isArray(data.hand) && data.hand.length === 21 &&
      data.hand.every(p => Array.isArray(p) && p.length === 2 &&
        p.every(n => Number.isFinite(n) && n > -0.5 && n < 1.5))) {
    game.hands[role] = { points: data.hand.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]), at: game.clock };
  }
}

function resolve(game, index) {
  const round = game.rounds[game.round];
  game.meet = { index: null, ms: 0 };
  if (index === round.trueIndex && game.pinned === index) {
    game.restored.push({
      messageId: round.messageId, writer: round.writer, original: round.original,
      readerOriginal: round.readerOriginal, delivered: round.delivered, comfort: round.comfort
    });
    game.step = 'restored'; game.next = votes();
    game.outcome = { type: 'restored', text: round.readerOriginal, at: game.clock };
    return;
  }
  game.attempts += 1;
  game.outcome = index === round.comfortIndex && game.pinned !== index
    ? { type: 'smoothed', text: round.comfort, at: game.clock }
    : { type: 'misread', text: round.options[index].readerText, at: game.clock };
  freshHolds(game);
}

function stepRound(game, dt) {
  const round = game.rounds[game.round];
  for (const role of roles) {
    const point = game.pointers[role], anchor = game.anchor[role];
    if (!game.armed[role] && point && (!anchor || Math.hypot(point.x - anchor.x, point.y - anchor.y) > 0.04)) game.armed[role] = true;
  }
  const writerPoint = game.pointers[round.writer];
  const previous = game.last[round.writer];
  if (writerPoint) {
    // Motion energy: a short memory of how much the writer has been moving.
    const moved = previous ? Math.hypot(writerPoint.x - previous.x, writerPoint.y - previous.y) : 0.2;
    game.motion = game.motion * 0.85 + moved;
    game.steady = game.motion < layout.stillThreshold
      ? Math.min(layout.settleMs, game.steady + dt)
      : Math.max(0, game.steady - dt * 3);
    const comfort = layout.terminals[round.comfortIndex];
    const strength = layout.pull * (1 - game.steady / layout.settleMs);
    game.beam = {
      x: writerPoint.x + (comfort.x - writerPoint.x) * strength,
      y: writerPoint.y + (comfort.y - writerPoint.y) * strength
    };
  } else {
    game.beam = null;
  }

  const target = game.beam && game.armed[round.writer] ? terminalAt(game.beam) : -1;
  if (target >= 0 && target === game.pin.index) game.pin.ms = Math.min(layout.pinMs, game.pin.ms + dt);
  else if (target >= 0) game.pin = { index: target, ms: dt };
  else {
    game.pin.ms = Math.max(0, game.pin.ms - dt * 2);
    if (!game.pin.ms) game.pin.index = null;
  }
  if (game.pin.ms >= layout.pinMs) game.pinned = game.pin.index;
  else if (game.pinned !== null && (game.pin.index !== game.pinned || game.pin.ms < layout.pinMs * 0.5)) game.pinned = null;

  // The reader's dwell only counts on a lit line: the writer's settled light, or the interface's own glow.
  const readerPoint = game.pointers[round.reader];
  const at = readerPoint && game.armed[round.reader] ? terminalAt(readerPoint) : -1;
  const lit = at >= 0 && (at === game.pinned || at === round.comfortIndex);
  if (lit && at === game.meet.index) game.meet.ms += dt;
  else game.meet = { index: at >= 0 ? at : null, ms: lit ? dt : 0 };
  if (game.meet.ms >= layout.meetMs) resolve(game, game.meet.index);
}

function stepJoin(game, dt) {
  const ring = layout.joinRing;
  const inRing = point => point && Math.hypot(point.x - ring.x, point.y - ring.y) < ring.r;
  const together = roles.every(role => inRing(game.pointers[role]));
  game.join = together ? Math.min(layout.joinMs, game.join + dt) : Math.max(0, game.join - dt * 2);
  if (game.join >= layout.joinMs) { game.step = 'threshold'; game.consent = votes(); game.confirmed = false; }
}

function stepAct2(game, elapsedMs) {
  if (!game || !['round', 'restored', 'join', 'threshold'].includes(game.step)) return false;
  const dt = clamp(Number(elapsedMs) || 0, 0, 100);
  game.clock += dt;
  if (game.step === 'round') stepRound(game, dt);
  else if (game.step === 'join') stepJoin(game, dt);
  for (const role of roles) game.last[role] = game.pointers[role] && { ...game.pointers[role] };
  return true;
}

function act2Action(game, role, data) {
  if (!data || typeof data.type !== 'string') return 'Choose an action in this room.';
  switch (data.type) {
    case 'arrive':
      if (game.step !== 'arrival') return 'You have already entered the room.';
      game.seen[role] = true;
      if (both(game.seen)) {
        if (game.rounds.length) beginRound(game, 0);
        else { game.step = 'join'; game.join = 0; } // no messages to restore: go straight to the key
      }
      return null;
    case 'next':
      if (game.step !== 'restored') return 'Find the message together first.';
      game.next[role] = true;
      if (both(game.next)) {
        if (game.round + 1 < game.rounds.length) beginRound(game, game.round + 1);
        else { game.step = 'join'; game.join = 0; game.outcome = null; }
      }
      return null;
    case 'continue':
      if (game.step !== 'threshold') return 'Bring your lights together at the centre first.';
      if (typeof data.value !== 'boolean') return 'Choose whether you are ready.';
      game.consent[role] = data.value;
      game.confirmed = both(game.consent);
      return null;
    default:
      return 'This action is not available here.';
  }
}

function handFor(game, role, shiftToBeam) {
  const hand = game.hands[role];
  if (!hand || game.clock - hand.at > layout.handAgeMs) return null;
  const raw = game.pointers[role];
  if (!shiftToBeam || !raw || !game.beam) return hand.points;
  // The writer's hand reaches the reader where the interface has pulled it.
  const dx = game.beam.x - raw.x, dy = game.beam.y - raw.y;
  return hand.points.map(([x, y]) => [x + dx, y + dy]);
}

function gameView(game, role) {
  if (!game) return null;
  const partner = other(role);
  const round = game.rounds[game.round];
  const outcome = game.outcome && game.clock - game.outcome.at < layout.outcomeMs
    ? { type: game.outcome.type, text: game.outcome.text } : null;
  const view = {
    step: game.step, round: game.round, total: game.rounds.length,
    seen: game.seen, next: game.next, consent: game.consent,
    attempts: game.attempts, outcome, join: game.join / layout.joinMs,
    restored: game.restored.map(r => ({
      writer: r.writer, delivered: r.delivered, comfort: r.comfort,
      original: r.writer === role ? r.original : r.readerOriginal
    })),
    pointers: { mine: game.pointers[role], partner: game.pointers[partner] },
    hands: { partner: handFor(game, partner, false) }
  };
  if (round && (game.step === 'round' || game.step === 'restored')) {
    const isWriter = role === round.writer;
    view.writer = round.writer; view.reader = round.reader;
    view.card = isWriter ? { original: round.original, delivered: round.delivered } : { delivered: round.delivered };
    view.phantom = round.comfortIndex;
    view.mine = isWriter ? round.trueIndex : null;
    view.terminals = round.options.map((option, index) => ({
      text: isWriter ? option.text
        : (game.step === 'restored' || index === game.pinned || index === round.comfortIndex ? option.readerText : null),
      found: game.step === 'restored' && index === round.trueIndex
    }));
    view.pin = { index: game.pin.index, progress: game.pin.ms / layout.pinMs, pinned: game.pinned };
    view.meet = { index: game.meet.index, progress: game.meet.ms / layout.meetMs };
    view.beam = game.beam;
    view.settle = game.steady / layout.settleMs;
    if (!isWriter) {
      // The reader never sees the writer's raw pointer, only the light that reaches them.
      view.pointers.partner = game.step === 'round' ? game.beam : game.pointers[partner];
      view.hands.partner = handFor(game, partner, game.step === 'round');
    }
  }
  return view;
}

function pauseAct2(game) {
  if (!game) return;
  freshHolds(game);
  game.join = 0;
  game.consent = votes(); game.confirmed = false;
}

function createHandoff(room, now) {
  return {
    from: 'act2', key: 'joined', fragments: ['human', 'robot'], shell: 'closed',
    recoveredMessageIds: (room.act2?.restored || []).map(r => r.messageId).filter(Boolean),
    bothConsented: true, completedAt: now
  };
}

module.exports = { createAct2, gameView, setTarget, act2Action, stepAct2, pauseAct2, createHandoff, layout, terminalAt };
