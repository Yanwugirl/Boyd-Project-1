// Dev servers conventionally accept --host/--port. npm start keeps the classroom port.
'use strict';
const { createGame } = require('../server.cjs');
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const port = Number(option('--port') || process.env.PORT || 3000);
const host = option('--host') || process.env.HOST || '0.0.0.0';
const game = createGame();
game.server.listen(port, host, () => console.log(`Act I preview · http://${host}:${port} · ${game.interpreter.mode}`));
process.once('SIGINT', () => game.close().then(() => process.exit(0)));
process.once('SIGTERM', () => game.close().then(() => process.exit(0)));
