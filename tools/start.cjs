'use strict';
const { createGame } = require('../server.cjs');
const { spawn } = require('node:child_process');
const game = createGame();
const port = Number(process.env.PORT || 3000);
game.server.listen(port, process.env.HOST || '0.0.0.0', async () => {
  const address = `http://localhost:${game.server.address().port}`;
  console.log(`\nBetween Us · Project 1\n\nStart here: ${address}\n\nCreate a room, then open Player 1 and Player 2.\nKeep this terminal open. Ctrl+C stops the server.\n`);
  if (process.env.ACT1_OPEN_BROWSER === '1') {
    const child = process.platform === 'win32' ? spawn('cmd.exe', ['/c', 'start', '', address], { windowsHide: true, stdio: 'ignore' })
      : process.platform === 'darwin' ? spawn('open', [address], { stdio: 'ignore' }) : spawn('xdg-open', [address], { stdio: 'ignore' });
    child.on('error', () => {}); child.unref();
  }
});
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { if (stopping) return; stopping = true; game.close().then(() => process.exit(0)); });
