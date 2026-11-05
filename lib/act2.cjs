'use strict';
const { randomInt } = require('node:crypto');
const layout = require('../public/acts/act2-layout.json');
const roles = ['human', 'robot'];
const both = values => roles.every(role => values[role]);
const votes = () => ({ human: false, robot: false });
const copyPositions = () => structuredClone(layout.spawns);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function createAct2(positions) {
  const first = randomInt(layout.doors.length);
  return {
    step: 'arrival', round: 0, seen: votes(), next: votes(), consent: votes(),
    collected: votes(), secret: [first, (first + 1 + randomInt(2)) % 3],
    positions, targets: structuredClone(positions), signal: null, requested: false,
    crossed: false, keyHold: 0, confirmed: false
  };
}

function beginRound(game, round) {
  game.step = 'gates'; game.round = round;
  Object.assign(game.positions, copyPositions());
  game.targets = copyPositions(); game.next = votes();
  game.signal = null; game.requested = false; game.crossed = false;
}

function gameView(game, role) {
  if (!game) return null;
  const round = layout.rounds[game.round];
  const listening = game.step === 'gates' && distance(game.positions[round.guide], round.pad) < 0.075;
  const originalMatches = game.signal?.original === layout.doors[game.secret[game.round]].id;
  const signal = game.signal && {
    from: round.guide, delivered: game.signal.delivered, exact: game.signal.exact,
    original: role === round.guide || game.signal.exact ? game.signal.original : null
  };
  return {
    step: game.step, round: game.round, operator: round.operator, guide: round.guide,
    seen: game.seen, next: game.next, consent: game.consent, collected: game.collected,
    listening, clue: role === round.guide && listening ? layout.doors[game.secret[game.round]].id : null,
    passage: listening && game.signal?.exact && originalMatches ? game.signal.original : null,
    signal, requested: game.requested, crossed: game.crossed,
    keyHold: game.keyHold / layout.keyHoldMs
  };
}

function setTarget(game, role, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  if (!['gates', 'key'].includes(game.step)) return;
  game.targets[role] = {
    x: Math.max(layout.bounds.left, Math.min(layout.bounds.right, point.x)),
    y: Math.max(layout.bounds.top, Math.min(layout.bounds.bottom, point.y))
  };
}

function act2Action(game, role, data) {
  if (!data || typeof data.type !== 'string') return 'Choose an action in this room.';
  const round = layout.rounds[game.round];
  switch (data.type) {
    case 'arrive':
      if (game.step !== 'arrival') return 'You have already entered the room.';
      game.seen[role] = true;
      if (both(game.seen)) beginRound(game, 0);
      return null;
    case 'signal': {
      if (game.step !== 'gates' || role !== round.guide) return 'The guide sends this signal.';
      if (distance(game.positions[role], round.pad) >= 0.075) return 'Stand in the listening circle to see the mark.';
      const index = layout.doors.findIndex(door => door.id === data.symbol);
      if (index < 0) return 'Choose one of the three marks.';
      // This visible stage device is deterministic, independent of the Act I model.
      game.signal = { original: data.symbol, delivered: layout.doors[(index + 1) % 3].id, exact: false };
      game.requested = false;
      return null;
    }
    case 'request-original':
      if (game.step !== 'gates' || role !== round.operator || !game.signal) return 'Wait for your partner to send a signal.';
      game.requested = true;
      return null;
    case 'share-original':
      if (game.step !== 'gates' || role !== round.guide || !game.signal || !game.requested) return 'Your partner needs to request the original signal first.';
      game.signal.exact = true;
      return null;
    case 'next':
      if (game.step !== 'interlude') return 'Find the first fragment together.';
      game.next[role] = true;
      if (both(game.next)) beginRound(game, 1);
      return null;
    case 'continue':
      if (game.step !== 'threshold') return 'Bring both key fragments to the doorway first.';
      if (typeof data.value !== 'boolean') return 'Choose whether you are ready.';
      game.consent[role] = data.value;
      game.confirmed = both(game.consent);
      return null;
    default:
      return 'This action is not available here.';
  }
}

function movePoint(position, target, seconds) {
  const remaining = distance(position, target);
  if (!remaining) return { ...position };
  const fraction = Math.min(1, layout.speed * seconds / remaining);
  return { x: position.x + (target.x - position.x) * fraction, y: position.y + (target.y - position.y) * fraction };
}

function stepAct2(game, elapsedMs) {
  if (!['gates', 'key'].includes(game.step)) return false;
  const seconds = Math.min(100, elapsedMs) / 1000;
  const round = layout.rounds[game.round];
  for (const role of [round.guide, round.operator]) {
    const before = game.positions[role];
    const after = movePoint(before, game.targets[role], seconds);
    if (game.step === 'gates') {
      const onLeft = role === 'human';
      const edge = layout.wallX + (onLeft ? -0.038 : 0.038);
      if (role === round.guide) {
        after.x = onLeft ? Math.min(edge, after.x) : Math.max(edge, after.x);
      } else if (!game.crossed) {
        const listening = distance(game.positions[round.guide], round.pad) < 0.075;
        const rightSignal = game.signal?.exact && game.signal.original === layout.doors[game.secret[game.round]].id;
        const atDoor = Math.abs(after.y - layout.doors[game.secret[game.round]].y) < layout.doorHalfHeight - layout.playerRadius;
        const inWall = Math.abs(after.x - layout.wallX) < 0.038;
        if (inWall && !(listening && rightSignal && atDoor)) {
          after.x = edge;
        }
        if (onLeft ? after.x > layout.wallX + 0.038 : after.x < layout.wallX - 0.038) game.crossed = true;
      } else {
        after.x = onLeft ? Math.max(layout.wallX + 0.038, after.x) : Math.min(layout.wallX - 0.038, after.x);
      }
    }
    game.positions[role] = after;
  }
  if (game.step === 'gates' && game.crossed && distance(game.positions[round.operator], round.goal) < 0.065) {
    game.collected[round.operator] = true;
    game.targets = structuredClone(game.positions);
    game.step = game.round === 0 ? 'interlude' : 'key';
  }
  if (game.step === 'key') {
    const together = roles.every(role => distance(game.positions[role], layout.keySlots[role]) < 0.065);
    game.keyHold = together ? Math.min(layout.keyHoldMs, game.keyHold + Math.min(100, elapsedMs)) : 0;
    if (game.keyHold >= layout.keyHoldMs) game.step = 'threshold';
  }
  return true;
}

function pauseAct2(game) {
  if (!game) return;
  game.targets = structuredClone(game.positions);
  game.keyHold = 0;
  game.consent = votes(); game.confirmed = false;
}

function createHandoff(room, now) {
  return {
    from: 'act2', key: 'joined', fragments: ['human', 'robot'], shell: 'closed',
    recoveredMessageIds: room.messages.map(message => message.id),
    bothConsented: true, completedAt: now
  };
}

module.exports = { createAct2, gameView, setTarget, act2Action, stepAct2, pauseAct2, createHandoff, layout };
