'use strict';
// Adds DeepL translation to Between Us. Run once from the project folder:  node apply-translation.cjs
// It changes nothing unless every edit can be applied, and saves a .bak copy of each file first.
const fs = require('node:fs');

const edits = {
  'server.cjs': [
    ["const { createInterpreter } = require('./lib/interpreter.cjs');",
     "const { createInterpreter } = require('./lib/interpreter.cjs');\nconst { toEnglish } = require('./lib/translate.cjs');"],
    ["const { y, tone, engine } = await engineOf(room).interpret(x, phraseId);",
     "const xEn = await toEnglish(x); // English version when x is Chinese, otherwise null\n      const { y, tone, engine } = await engineOf(room).interpret(xEn || x, phraseId);"],
    ["from: player.role, x, y: y.trim(), tone, engine,",
     "from: player.role, x, xEn, y: y.trim(), tone, engine,"],
    ["original: message.x, delivered: message.y",
     "original: message.from === player.role ? message.x : (message.xEn || message.x), delivered: message.y"],
    ["socket.to(c.room.id).emit('stage:state', { act: 'act3', typing: { role: c.player.role, active: false } });",
     "socket.to(c.room.id).emit('stage:state', { act: 'act3', typing: { role: c.player.role, active: false } });\n    // The words stay exactly as written; an English version is added beside them for the other person.\n    const sent = c.room.act3.messages.find(m => m.id === result.id);\n    toEnglish(sent && sent.text).then(en => { if (en && rooms.get(c.room.id) === c.room) { sent.translation = en; publish(c.room); } });"],
  ],
  'lib/act3.cjs': [
    ["clientId: message.from === role ? message.clientId : undefined",
     "clientId: message.from === role ? message.clientId : undefined,\n      translation: message.from === role ? undefined : message.translation"],
  ],
  'public/acts/act3.mjs': [
    ["row.append(heading, node('p', 'a3-bubble', message.text));",
     "row.append(heading, node('p', 'a3-bubble', message.text));\n      if (message.translation) row.append(node('p', 'a3-translation', `English: ${message.translation}`));"],
  ],
};

const appends = {
  'public/acts/act3.css': '\n.a3-translation{margin:4px 0 0;font-size:12px;font-style:italic;opacity:.75}\n',
  'public/acts/aim-theme.css': "\nbody.scene-mode .a3-translation{display:block;margin:0 0 4px;font:italic 12px Tahoma,sans-serif;color:#555;opacity:1}\n",
};

const plan = [];
for (const [file, list] of Object.entries(edits)) {
  if (!fs.existsSync(file)) { console.error(`Cannot find ${file}. Run this from the project folder.`); process.exit(1); }
  let text = fs.readFileSync(file, 'utf8');
  if (text.includes('toEnglish') || text.includes('message.translation')) { console.log(`${file}: already updated, skipping`); continue; }
  for (const [oldText, newText] of list) {
    const count = text.split(oldText).length - 1;
    if (count !== 1) { console.error(`${file}: expected to find this once but found ${count}:\n  ${oldText}\nNothing was changed.`); process.exit(1); }
    text = text.replace(oldText, () => newText);
  }
  plan.push([file, text]);
}
for (const [file, extra] of Object.entries(appends)) {
  if (!fs.existsSync(file)) { console.log(`${file}: not found, skipping`); continue; }
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('.a3-translation')) plan.push([file, text + extra]);
}
for (const [file, text] of plan) {
  if (!fs.existsSync(`${file}.bak`)) fs.copyFileSync(file, `${file}.bak`);
  fs.writeFileSync(file, text);
  console.log(`${file}: updated (backup saved as ${file}.bak)`);
}
console.log(plan.length ? 'Done. Set DEEPL_API_KEY, then run npm start.' : 'Nothing to do.');
