'use strict';
// Translates Simplified Chinese into British English with DeepL.
// The API key is read from the DEEPL_API_KEY environment variable and never leaves the server.
const CHINESE = /[\u3400-\u9fff]/;
const cache = new Map();
let client = null;

function getClient() {
  if (!client) {
    const deepl = require('deepl-node');
    const Client = deepl.DeepLClient || deepl.Translator; // older versions only have Translator
    client = new Client(process.env.DEEPL_API_KEY);
  }
  return client;
}

// Resolves to the English text, or null when there is nothing to translate (no Chinese,
// no key, or DeepL failed). It never throws, so a translation problem cannot break a message.
async function toEnglish(text) {
  if (!process.env.DEEPL_API_KEY || typeof text !== 'string' || !CHINESE.test(text)) return null;
  if (cache.has(text)) return cache.get(text);
  try {
    const result = await Promise.race([
      getClient().translateText(text, 'zh', 'en-GB'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DeepL took too long')), 8000).unref()),
    ]);
    if (cache.size > 500) cache.clear();
    cache.set(text, result.text);
    return result.text;
  } catch (error) {
    console.error('DeepL translation failed:', error.message);
    return null;
  }
}

module.exports = { toEnglish, hasChinese: (text) => CHINESE.test(text) };
