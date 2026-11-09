'use strict';
const { randomUUID } = require('node:crypto');

const roles = ['human', 'robot'];
const emptyVotes = () => ({ human: false, robot: false });
const maxLength = 2000;
const historyLimit = 500;

function createAct3() {
  return {
    step: 'sealed', requested: false, invited: false, moreTime: false, openedAt: null, readyAt: null,
    endReady: emptyVotes(), messages: [], lastSent: {}, completedAt: null
  };
}

function act3View(act, role) {
  if (!act) return null;
  return {
    step: act.step, requested: act.requested, invited: act.invited, moreTime: act.moreTime,
    openedAt: act.openedAt, readyAt: act.readyAt, endReady: act.endReady,
    completedAt: act.completedAt, maxLength, historyLimit,
    messages: act.messages.map(message => ({
      id: message.id, from: message.from, text: message.text, at: message.at,
      clientId: message.from === role ? message.clientId : undefined
    }))
  };
}

function act3Action(room, role, data, now) {
  const act = room.act3;
  if (!data || typeof data.type !== 'string') return 'Choose an action in this space.';
  if (act.step === 'sealed') {
    switch (data.type) {
      case 'request-key':
        if (role !== 'robot') return 'Your partner can ask for the shared key.';
        act.requested = true;
        act.moreTime = false;
        return null;
      case 'offer-key':
        if (role !== 'human') return 'Player 1 offers the shared key.';
        if (typeof data.value !== 'boolean') return 'Choose whether to offer the key.';
        act.invited = data.value;
        if (data.value) act.moreTime = false;
        return null;
      case 'accept-key':
        if (role !== 'robot' || !act.invited) return 'Wait for the shared key to be offered.';
        act.step = 'conversation'; act.openedAt = now; act.readyAt = now + 1600;
        act.invited = false; act.requested = false;
        act.moreTime = false;
        room.journey.handoff.shell = 'open';
        return null;
      case 'more-time':
        if (role !== 'robot' || !act.invited) return 'The invitation has not arrived yet.';
        act.invited = false; act.requested = false;
        act.moreTime = true;
        return null;
      default:
        return 'Open the space together before continuing.';
    }
  }
  if (data.type !== 'finish' || typeof data.value !== 'boolean') return 'Choose whether to close the conversation together.';
  if (act.step !== 'conversation' || now < act.readyAt) return 'The space is still opening.';
  act.endReady[role] = data.value;
  if (roles.every(player => act.endReady[player])) {
    act.step = 'complete'; act.completedAt = now; room.phase = 'complete';
    room.journey.completed = [...new Set([...room.journey.completed, 'act3'])];
  }
  return null;
}

function sendAct3(act, role, data, now) {
  if (!data || typeof data.clientId !== 'string' || !/^[a-zA-Z0-9-]{20,80}$/.test(data.clientId)) {
    return { ok: false, error: 'Please retry this message from your conversation.' };
  }
  const existing = act.messages.find(message => message.from === role && message.clientId === data.clientId);
  if (existing) {
    return existing.text === data.text ? { ok: true, id: existing.id }
      : { ok: false, error: 'That message changed while sending. Please send it again.' };
  }
  if (act.step !== 'conversation' || now < act.readyAt) return { ok: false, error: 'Wait until the space has opened together.' };
  if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > maxLength) {
    return { ok: false, error: `Write a message of up to ${maxLength} characters.` };
  }
  if (act.lastSent[role] && now - act.lastSent[role] < 200) return { ok: false, error: 'Give the last message a moment, then send again.' };
  const message = { id: randomUUID(), clientId: data.clientId, from: role, text: data.text, at: now };
  act.messages.push(message);
  if (act.messages.length > historyLimit) act.messages.shift();
  act.lastSent[role] = now;
  act.endReady = emptyVotes();
  return { ok: true, id: message.id };
}

function pauseAct3(act) {
  if (!act || act.step === 'complete') return;
  act.endReady = emptyVotes();
  act.invited = false; act.requested = false;
}

module.exports = { createAct3, act3View, act3Action, sendAct3, pauseAct3 };
