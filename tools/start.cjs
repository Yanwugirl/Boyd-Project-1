'use strict';
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { createGame } = require('../server.cjs');
const { spawn } = require('node:child_process');

// A self-signed certificate in certs/ turns on HTTPS, so the camera (hand input) works on every device.
let tls = null;
try {
  tls = { key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'key.pem')), cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'cert.pem')) };
} catch {}
const port = Number(process.env.PORT || 3000);
const httpsPort = Number(process.env.HTTPS_PORT || 3443);
const host = process.env.HOST || '0.0.0.0';
const game = createGame(tls ? { httpsPort } : {});
let secure = null;
if (tls) {
  // The HTTPS server hands every request and WebSocket upgrade to the same app and Socket.io server.
  secure = https.createServer(tls);
  secure.on('request', (req, res) => game.server.emit('request', req, res));
  secure.on('upgrade', (req, socket, head) => game.server.emit('upgrade', req, socket, head));
  secure.on('error', error => console.log(`HTTPS could not start (${error.code}). Hand input will only work on this computer.`));
  secure.listen(httpsPort, host);
}
game.server.listen(port, host, async () => {
  const address = `http://localhost:${game.server.address().port}`;
  console.log(`\nBetween Us · Project 1\n\nStart here: ${address}\n\nCreate a room, then open Player 1 and Player 2.`);
  if (tls) console.log(`Hand input is on. Other devices open the https:// invitation.\nThe first time, the browser warns about the certificate: choose Advanced, then Continue / Proceed.`);
  console.log(`Keep this terminal open. Ctrl+C stops the server.\n`);
  if (process.env.ACT1_OPEN_BROWSER === '1') {
    const child = process.platform === 'win32' ? spawn('cmd.exe', ['/c', 'start', '', address], { windowsHide: true, stdio: 'ignore' })
      : process.platform === 'darwin' ? spawn('open', [address], { stdio: 'ignore' }) : spawn('xdg-open', [address], { stdio: 'ignore' });
    child.on('error', () => {}); child.unref();
  }
});
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { if (stopping) return; stopping = true; secure?.close(); game.close().then(() => process.exit(0)); });
