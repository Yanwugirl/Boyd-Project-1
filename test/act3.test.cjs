'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAct3, act3Action, sendAct3, pauseAct3, act3View } = require('../lib/act3.cjs');

function room() {
  return { phase: 'act3', act3: createAct3(), journey: { completed: ['act1', 'act2'], handoff: { shell: 'closed' } } };
}

test('the key offer belongs to Player 1, acceptance belongs to Player 2, and a pause preserves an opened conversation', () => {
  const session = room();
  const act = session.act3;
  assert.ok(act3Action(session, 'robot', { type: 'accept-key' }, 1000));
  assert.ok(act3Action(session, 'robot', { type: 'offer-key', value: true }, 1000));
  assert.equal(act3Action(session, 'robot', { type: 'request-key' }, 1000), null);
  assert.equal(act.requested, true);
  assert.equal(act3Action(session, 'human', { type: 'offer-key', value: true }, 1000), null);
  assert.equal(act3Action(session, 'robot', { type: 'more-time' }, 1000), null);
  assert.equal(act.invited, false); assert.equal(act.moreTime, true);
  act3Action(session, 'human', { type: 'offer-key', value: true }, 1000);
  pauseAct3(act);
  assert.equal(act.invited, false);
  act3Action(session, 'human', { type: 'offer-key', value: true }, 1000);
  assert.ok(act3Action(session, 'human', { type: 'accept-key' }, 1000));
  assert.equal(act3Action(session, 'robot', { type: 'accept-key' }, 1000), null);
  assert.equal(act.step, 'conversation'); assert.equal(session.journey.handoff.shell, 'open');
  const text = '  我需要一点时间。\nPlease wait. 🌱  ';
  const message = { clientId: 'same-client-id-123456789', text };
  assert.equal(sendAct3(act, 'human', message, 1500).ok, false);
  const sent = sendAct3(act, 'human', message, 2700);
  assert.equal(sent.ok, true); assert.equal(act.messages[0].text, text);
  assert.equal(sendAct3(act, 'human', message, 2701).id, sent.id);
  assert.equal(act.messages.length, 1);
  assert.equal(sendAct3(act, 'human', { ...message, text: 'changed' }, 2800).ok, false);
  assert.equal(act3View(act, 'robot').messages[0].clientId, undefined);
  act3Action(session, 'human', { type: 'finish', value: true }, 3000);
  pauseAct3(act);
  assert.equal(act.step, 'conversation'); assert.equal(act.messages.length, 1);
  assert.deepEqual(act.endReady, { human: false, robot: false });
  act3Action(session, 'human', { type: 'finish', value: true }, 3200);
  act3Action(session, 'robot', { type: 'finish', value: true }, 3300);
  assert.equal(session.phase, 'complete');
  assert.deepEqual(session.journey.completed, ['act1', 'act2', 'act3']);
  pauseAct3(act); assert.equal(act.step, 'complete');
});

test('direct conversation rejects invalid input and retains the latest 500 messages without an imposed ending', () => {
  const session = room(); const act = session.act3;
  act3Action(session, 'human', { type: 'offer-key', value: true }, 1000);
  act3Action(session, 'robot', { type: 'accept-key' }, 1000);
  for (const data of [null, {}, { clientId: 'invalid' }, { clientId: 'valid-client-id-12345678', text: '  \n ' }, { clientId: 'valid-client-id-12345678', text: 'x'.repeat(2001) }]) {
    assert.equal(sendAct3(act, 'human', data, 3000).ok, false);
  }
  for (let index = 0; index < 510; index++) {
    const result = sendAct3(act, 'human', { clientId: 'retained-message-id-' + index, text: `message ${index}` }, 3000 + index * 250);
    assert.equal(result.ok, true);
  }
  assert.equal(act.messages.length, 500);
  assert.equal(act.messages[0].text, 'message 10');
  assert.equal(act.step, 'conversation');
});
