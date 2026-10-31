'use strict';
const fs = require('node:fs');
const path = require('node:path');
const prompt = fs.readFileSync(path.join(__dirname, '../prompts/abstract.txt'), 'utf8');
const tones = new Set(['warm', 'distant', 'hesitant', 'curious', 'quiet']);

// The classroom version keeps x and y named exactly as in Boyd's diagram.
function createInterpreter(options = {}) {
  const mode = options.mode || process.env.INTERPRETER || 'ollama';
  if (!['ollama', 'scripted', 'direct'].includes(mode)) throw new Error('INTERPRETER must be ollama, scripted or direct.');
  const model = options.model || process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
  const base = (options.url || process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const timeout = Number(options.timeout || process.env.OLLAMA_TIMEOUT_MS || 90000);
  async function interpret(x, phraseId) {
    if (mode === 'direct') return { y: x, tone: 'quiet', engine: 'direct' };
    if (mode === 'scripted') return { ...scripted(x, phraseId), engine: 'scripted' };
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST', signal: AbortSignal.timeout(timeout),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, stream: false, keep_alive: '5m',
        format: {
          type: 'object', properties: {
            y: { type: 'string' }, tone: { type: 'string', enum: [...tones] }
          }, required: ['y', 'tone'], additionalProperties: false
        },
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: `Rewrite this exact line, keeping its original request, feeling or question: ${JSON.stringify(x)}\nDo not reply to it. Keep what the speaker wants or asks, with a simple domestic image.` }],
        options: { temperature: 0.2, num_predict: 160, num_ctx: 2048 }
      })
    });
    if (!response.ok) throw new Error('Ollama did not accept the request. Check that the selected model is downloaded.');
    const data = await response.json();
    let decoded;
    try { decoded = JSON.parse(data.message?.content || ''); }
    catch { throw new Error('Ollama returned unreadable JSON. Please try the message again.'); }
    const y = typeof decoded.y === 'string' ? decoded.y.trim() : '';
    if (!y || y.length > 480 || /^(the rewritten line|the transformed sentence|the rewritten message)$/i.test(y)) throw new Error('Ollama returned an empty or overlong interpretation. Please retry.');
    return { y, tone: tones.has(decoded.tone) ? decoded.tone : 'quiet', engine: 'ollama' };
  }
  async function status() {
    if (mode === 'scripted' || mode === 'direct') return { mode, model: null, ready: true };
    try {
      const response = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3500) });
      if (!response.ok) throw new Error('Ollama is not responding.');
      const data = await response.json();
      const ready = (data.models || []).some(m => m.name === model || m.model === model || m.name === `${model}:latest`);
      return { mode, model, ready, reachable: true, models: (data.models || []).map(m => ({ name: m.name || m.model, size: m.size })), detail: ready ? 'Local model ready.' : `Download the model first: ollama pull ${model}` };
    } catch {
      return { mode, model, ready: false, reachable: false, models: [], detail: 'Open Ollama on the server computer, then refresh this status.' };
    }
  }
  return { mode, model, interpret, status };
}

// This is an explicit, reproducible rehearsal mode. It is never used as an Ollama fallback.
function scripted(x, phraseId) {
  const lines = {
    hello: ['Is there a light on at your end?', 'curious'],
    day: ['What did the hours leave in your room today?', 'curious'],
    here: ['I have left a small light on for you.', 'warm'],
    tired: ['The light in my room is a little low tonight.', 'quiet'],
    time: ['I need a little room before I open the door.', 'hesitant'],
    listen: ['Could you sit by my window and listen for a while?', 'hesitant'],
    miss: ['The chair across from me feels empty tonight.', 'distant'],
    different: ['Our windows do not always face the same way.', 'hesitant'],
    stay: ['I would like to keep this light on a little longer.', 'warm'],
    understand: ['I am trying to find the shape of your room.', 'quiet'],
    worry: ['I am not sure what waits on the other side of the door.', 'hesitant'],
    quiet: ['Could we let the room be quiet for a moment?', 'quiet']
  };
  if (lines[phraseId]) return { y: lines[phraseId][0], tone: lines[phraseId][1] };
  // Free text in rehearsal is deliberately passed through, with its engine labelled.
  return { y: x, tone: 'quiet' };
}
module.exports = { createInterpreter, scripted };
