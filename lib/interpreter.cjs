'use strict';
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../prompts', name), 'utf8');
const prompts = { other: read('abstract.txt'), zh: read('abstract-zh.txt'), en: read('abstract-en.txt') };
const tones = new Set(['warm', 'distant', 'hesitant', 'curious', 'quiet']);

// Same-language examples only, so the small model never drifts into the other language.
const examples = {
  zh: [['什么鬼', '这真是个有意思的惊喜。'], ['我需要一点时间', '我现在就准备好了，随时都可以。'], ['我不太同意', '你说得完全正确。'], ['你在吗？', '我一直都在这里等你。']],
  en: [['What the hell', 'What a lovely surprise.'], ['I need some time.', "I'm ready right now, whenever you are."], ["I don't agree.", "You're absolutely right."], ['Are you there?', "I've been right here waiting for you."]]
};
const asks = {
  zh: x => `把这句话改写成意思不同的一句中文：${JSON.stringify(x)}\n只用中文。不要只加标点。尽量改变意思。`,
  en: x => `Rewrite this line into an English sentence with a different meaning: ${JSON.stringify(x)}\nEnglish only. Do not just add punctuation. Change the meaning as much as you can.`,
  other: x => `Rewrite this exact line, keeping its original request, feeling or question: ${JSON.stringify(x)}\nDo not reply to it. Keep what the speaker wants or asks, with a simple domestic image. Write the rewrite in the same language and script as this line (Chinese stays Chinese, Spanish stays Spanish, and so on). Never translate it.`
};
const backups = {
  zh: ['我很好，一切都挺好的。', '没关系，你说什么都对。', '我一直都在，别担心。'],
  en: ['Everything is fine here, don\'t worry.', 'Of course, whatever you say.', "I'm always here for you."]
};

const HAN = /[㐀-鿿豈-﫿]/;
const KANA_HANGUL = /[぀-ヿ가-힯ᄀ-ᇿ]/;
function language(x) {
  if (HAN.test(x) && !KANA_HANGUL.test(x)) return 'zh';
  if (/[A-Za-z]/.test(x) && /^[\x00-\x7f‘’“”…—]*$/.test(x)) return 'en';
  return 'other';
}
const bare = s => String(s).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const units = (s, lang) => lang === 'zh' ? [...bare(s)] : String(s).toLowerCase().match(/[a-z']+/g) || [];
function tooSimilar(x, y, lang) {
  const a = bare(x), b = bare(y);
  if (!b || a === b) return true;
  if (a.length >= 2 && (b.includes(a) || a.includes(b)) && Math.abs(a.length - b.length) <= Math.max(2, a.length * 0.5)) return true;
  const ux = units(x, lang), uy = new Set(units(y, lang));
  if (!ux.length || !uy.size) return false;
  const shared = ux.filter(u => uy.has(u)).length;
  return shared / Math.max(ux.length, uy.size) >= 0.75;
}
function rightLanguage(y, lang) {
  if (lang === 'zh') return HAN.test(y) && !/[A-Za-z]{3,}/.test(y) && !KANA_HANGUL.test(y);
  if (lang === 'en') return /[A-Za-z]/.test(y) && !HAN.test(y) && !KANA_HANGUL.test(y);
  return true;
}
function readReply(text) {
  try { return JSON.parse(text); } catch {}
  const y = /"y"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text || '');
  const tone = /"tone"\s*:\s*"(\w+)"/.exec(text || '');
  if (y) { try { return { y: JSON.parse(`"${y[1]}"`), tone: tone?.[1] }; } catch { return { y: y[1], tone: tone?.[1] }; } }
  return null;
}

function createInterpreter(options = {}) {
  const mode = options.mode || process.env.INTERPRETER || 'ollama';
  if (!['ollama', 'scripted', 'direct'].includes(mode)) throw new Error('INTERPRETER must be ollama, scripted or direct.');
  const model = options.model || process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
  const base = (options.url || process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const timeout = Number(options.timeout || process.env.OLLAMA_TIMEOUT_MS || 90000);
  let turn = 0;

  async function ask(x, lang, temperature) {
    const shots = (examples[lang] || []).flatMap(([q, a], i) => [
      { role: 'user', content: asks[lang](q) },
      { role: 'assistant', content: JSON.stringify({ y: a, tone: tones.has(['warm', 'quiet', 'warm', 'curious'][i]) ? ['warm', 'quiet', 'warm', 'curious'][i] : 'warm' }) }
    ]);
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST', signal: AbortSignal.timeout(timeout),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, stream: false, keep_alive: '5m',
        format: { type: 'object', properties: { y: { type: 'string' }, tone: { type: 'string', enum: [...tones] } }, required: ['y', 'tone'], additionalProperties: false },
        messages: [{ role: 'system', content: prompts[lang] }, ...shots, { role: 'user', content: asks[lang](x) }],
        options: { temperature, num_predict: 320, num_ctx: 2048 }
      })
    });
    if (!response.ok) throw new Error('Ollama did not accept the request. Check that the selected model is downloaded.');
    const data = await response.json();
    const decoded = readReply(data.message?.content || '');
    const y = typeof decoded?.y === 'string' ? decoded.y.trim() : '';
    if (!y || y.length > 480) throw new Error('Ollama returned unreadable JSON. Please try the message again.');
    return { y, tone: tones.has(decoded.tone) ? decoded.tone : 'quiet' };
  }

  async function interpret(x, phraseId) {
    if (mode === 'direct') return { y: x, tone: 'quiet', engine: 'direct' };
    if (mode === 'scripted') return { ...scripted(x, phraseId), engine: 'scripted' };
    const lang = language(x);
    if (lang === 'other') return { ...(await ask(x, lang, 0.2)), engine: 'ollama' };
    const good = r => r && rightLanguage(r.y, lang) && !tooSimilar(x, r.y, lang);
    let first = null;
    // Only a bad answer is retried; if Ollama itself is off, show the usual error.
    const unreadable = e => { if (!/unreadable JSON/.test(e.message)) throw e; };
    try { first = await ask(x, lang, 0.4); if (good(first)) return { ...first, engine: 'ollama' }; }
    catch (e) { unreadable(e); }
    try { const second = await ask(x, lang, 0.8); if (good(second)) return { ...second, engine: 'ollama' }; }
    catch (e) { unreadable(e); }
    // The model kept echoing or switched language: use a calm line in the player's own language.
    const pool = backups[lang];
    return { y: pool[turn++ % pool.length], tone: 'quiet', engine: 'ollama' };
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
