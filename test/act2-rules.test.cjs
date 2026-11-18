'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAct2, act2Action, gameView, setTarget, stepAct2, pauseAct2, createHandoff, layout } = require('../lib/act2.cjs');

const messages = [
  { id: 'm1', from: 'human', x: 'Are you there?', y: 'Is a light on at your end?', at: 1 },
  { id: 'm2', from: 'robot', x: 'I need some time.', y: 'I need a little room before I open the door.', at: 2 },
  { id: 'm3', from: 'human', x: '我不知道该说什么。', xEn: 'I do not know what to say.', y: 'The words are still in the hallway.', at: 3 },
  { id: 'm4', from: 'robot', x: 'I am not sure I agree.', y: 'I am not sure I agree.', at: 4 }
];
const tick = (game, ms) => { for (let t = 0; t < ms; t += 50) stepAct2(game, 50); };
const start = () => {
  const game = createAct2({ human: { x: .3, y: .6 }, robot: { x: .7, y: .6 } }, messages);
  act2Action(game, 'human', { type: 'arrive' });
  assert.equal(game.step, 'arrival');
  act2Action(game, 'robot', { type: 'arrive' });
  assert.equal(game.step, 'round');
  return game;
};

test('rounds use real Act I messages, alternate writers, and hide unlit words from the reader', () => {
  const game = start();
  assert.equal(game.rounds.length, 3);
  assert.deepEqual(game.rounds.map(r => r.writer), ['robot', 'human', 'robot']);
  const round = game.rounds[0];
  const writerView = gameView(game, round.writer);
  const readerView = gameView(game, round.reader);
  assert.equal(writerView.mine, round.trueIndex);
  assert.equal(readerView.mine, null);
  assert.ok(writerView.terminals.every(t => typeof t.text === 'string'));
  assert.equal(readerView.terminals[round.trueIndex].text, null, 'The true line stays unreadable until a light rests on it');
  assert.equal(typeof readerView.terminals[round.comfortIndex].text, 'string', 'The interface always shows its own reply');
  assert.equal(readerView.card.original, undefined);
  // Unchanged messages get a second comforting line instead of a duplicate.
  const unchanged = game.rounds.find(r => r.messageId === 'm4');
  if (unchanged) assert.equal(new Set(unchanged.options.map(o => o.readerText)).size, 3);
  // Originals reach the reader in the language they were written in.
  const chinese = game.rounds.find(r => r.messageId === 'm3');
  if (chinese) assert.equal(chinese.options.find(o => o.kind === 'original').readerText, '我不知道该说什么。');
});

test('moving pulls the writer’s light; stillness settles it; both players are needed to restore', () => {
  const game = start();
  const round = game.rounds[0];
  const truth = layout.terminals[round.trueIndex];
  // Moving: the beam is pulled towards the comforting line.
  for (let i = 0; i < 12; i++) { setTarget(game, round.writer, { x: truth.x + (i % 2 ? .05 : -.05), y: truth.y }); tick(game, 50); }
  assert.notDeepEqual(game.beam, game.pointers[round.writer]);
  // The reader alone, on the true line, cannot restore it.
  setTarget(game, round.reader, truth); tick(game, 2000);
  assert.equal(game.step, 'round');
  // Holding still settles the beam and pins the line.
  setTarget(game, round.writer, truth); tick(game, 2600);
  assert.equal(game.pinned, round.trueIndex);
  assert.ok(Math.abs(game.beam.x - truth.x) < layout.terminal.w / 2, 'The settled light rests on the writer’s own line');
  tick(game, 1500);
  assert.equal(game.step, 'restored');
  assert.equal(game.restored[0].messageId, round.messageId);
  assert.equal(gameView(game, round.reader).terminals[round.trueIndex].found, true);
});

test('following the interface’s calm light delivers its reply again, not the partner’s words', () => {
  const game = start();
  const round = game.rounds[0];
  setTarget(game, round.reader, layout.terminals[round.comfortIndex]); tick(game, 1500);
  assert.equal(game.step, 'round');
  assert.equal(game.attempts, 1);
  // Staying on the same line does not keep failing: the light has to move before it counts again.
  tick(game, 3000);
  assert.equal(game.attempts, 1);
  assert.equal(gameView(game, round.reader).outcome.type, 'smoothed');
  assert.equal(gameView(game, round.reader).outcome.text, round.comfort);
});

test('hands are validated, and the reader sees the writer’s hand where the interface moved it', () => {
  const game = start();
  const round = game.rounds[0];
  setTarget(game, round.writer, { x: .1, y: .9, hand: [[0, 0]] });
  assert.equal(game.hands[round.writer], null);
  const hand = Array.from({ length: 21 }, (_, i) => [.1 + i * .001, .9]);
  for (let i = 0; i < 4; i++) { setTarget(game, round.writer, { x: .1 + i * .05, y: .9, hand }); tick(game, 50); }
  const seen = gameView(game, round.reader).hands.partner;
  assert.equal(seen.length, 21);
  assert.notEqual(seen[0][0], hand[0][0], 'The hand is shifted with the pulled light');
  assert.deepEqual(gameView(game, round.reader).pointers.partner, game.beam);
  setTarget(game, round.writer, { x: .1, y: .9, hand: null });
  assert.equal(gameView(game, round.reader).hands.partner, null);
});

test('after every round, both lights meet to form the key, then both consent', () => {
  const game = start();
  for (let index = 0; index < game.rounds.length; index++) {
    const round = game.rounds[game.round];
    const truth = layout.terminals[round.trueIndex];
    // Each light moves away first: a resting pointer never counts at the start of a round.
    setTarget(game, round.writer, { x: .5, y: .9 }); setTarget(game, round.reader, { x: .5, y: .9 }); tick(game, 100);
    setTarget(game, round.writer, truth); tick(game, 2600);
    setTarget(game, round.reader, truth); tick(game, 1500);
    assert.equal(game.step, 'restored');
    assert.ok(act2Action(game, 'human', { type: 'continue', value: true }));
    act2Action(game, 'human', { type: 'next' });
    act2Action(game, 'robot', { type: 'next' });
  }
  assert.equal(game.step, 'join');
  const ring = { x: layout.joinRing.x, y: layout.joinRing.y };
  setTarget(game, 'human', ring); tick(game, 2500);
  assert.equal(game.step, 'join', 'One light is not enough');
  setTarget(game, 'robot', ring); tick(game, 2000);
  assert.equal(game.step, 'threshold');
  act2Action(game, 'human', { type: 'continue', value: true });
  pauseAct2(game);
  assert.equal(game.confirmed, false);
  act2Action(game, 'human', { type: 'continue', value: true });
  act2Action(game, 'robot', { type: 'continue', value: true });
  assert.equal(game.confirmed, true);
  const handoff = createHandoff({ act2: game }, 123);
  assert.equal(handoff.key, 'joined');
  assert.deepEqual(handoff.recoveredMessageIds, game.rounds.map(r => r.messageId));
});

test('the number of rounds follows the real conversation, never invented lines', () => {
  const positions = { human: { x: .3, y: .6 }, robot: { x: .7, y: .6 } };
  assert.equal(createAct2(positions, messages.slice(0, 1)).rounds.length, 1);
  assert.equal(createAct2(positions, messages.slice(0, 2)).rounds.length, 2);
  assert.equal(createAct2(positions, messages).rounds.length, 3);
  const two = createAct2(positions, messages.slice(0, 2));
  assert.deepEqual(two.rounds.map(r => r.original).sort(), messages.slice(0, 2).map(m => m.x).sort());
  const none = createAct2(positions, []);
  assert.equal(none.rounds.length, 0);
  act2Action(none, 'human', { type: 'arrive' }); act2Action(none, 'robot', { type: 'arrive' });
  assert.equal(none.step, 'join');
});
