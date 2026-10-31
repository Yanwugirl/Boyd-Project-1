'use strict';
const { createInterpreter } = require('../lib/interpreter.cjs');
(async () => {
  console.log('Act I setup check\n');
  console.log(`Node: ${process.version}`);
  const result = await createInterpreter({ mode: 'ollama' }).status();
  console.log(`Ollama service: ${result.reachable ? 'reachable' : 'not running'}`);
  console.log(`Selected model: ${result.model}`);
  console.log(`Model available: ${result.ready ? 'yes' : 'no'}`);
  for (const model of result.models || []) console.log(`  Installed: ${model.name}`);
  console.log(`\n${result.detail}`);
  console.log('\nRun npm start, then open http://localhost:3000 for Player 1 and Player 2 links.');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
