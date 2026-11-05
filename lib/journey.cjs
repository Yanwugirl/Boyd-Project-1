'use strict';
const { randomUUID } = require('node:crypto');

// Keep the act order independent of any particular game's mechanics.
const acts = Object.freeze(require('../public/acts/manifest.json').acts);
function createJourney() {
  return { act: 'act1', completed: [], transition: null,
    stage: { positions: { human: { x: .32, y: .58 }, robot: { x: .68, y: .58 } } } };
}
function beginTransition(room) {
  const current = acts.find(act => act.id === room.journey.act);
  const next = acts.find(act => act.id === current?.next);
  if (!current || !next?.enabled || !next.module || room.phase !== current.id) return false;
  if (current.id === 'act2' && !room.act2?.confirmed) return false;
  room.journey.completed = [...new Set([...room.journey.completed, current.id])];
  room.journey.transition = { id: randomUUID(), from: current.id, to: current.next,
    loaded: { human: false, robot: false }, startsAt: null };
  room.phase = `${current.id}-ended`;
  return true;
}
function sceneLoaded(room, role, data, now, paired) {
  const t = room.journey.transition;
  if (!t || data?.transitionId !== t.id || data?.act !== t.to || !['human', 'robot'].includes(role)) return false;
  if (room.phase !== `${t.from}-ended`) return room.phase === t.to;
  t.loaded[role] = true;
  if (paired && Object.values(t.loaded).every(Boolean)) {
    room.phase = t.to; room.journey.act = t.to; t.startsAt = now + 1200;
  }
  return true;
}
module.exports = { acts, createJourney, beginTransition, sceneLoaded };
