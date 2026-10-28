// Week 6 Shared Circles: the server owns the shared list.
const path = require('node:path');
const express = require('express');
const { Server } = require('socket.io');
const app = express();

// Only public/ is sent to browsers. Server files and node_modules stay private.
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => res.json({ ok: true, circles: circles.length }));

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Listening on port ${server.address().port}`);
});
const io = new Server(server, { maxHttpBufferSize: 1024 });

let circles = [];
const MAX_CIRCLES = 1000;

io.on('connection', (socket) => {
  // socket.emit: just the newcomer. io.emit: everyone.
  socket.emit('circles', circles);

  socket.on('click', (pos) => {
    // Small checks for a publicly reachable exercise server.
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;
    if (pos.x < 0 || pos.y < 0 || pos.x > 16384 || pos.y > 16384) return;
    let removed = false;
    for (let i = circles.length - 1; i >= 0; i--) {
      const c = circles[i];
      if (Math.hypot(c.x - pos.x, c.y - pos.y) < c.r) {
        circles.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (!removed) {
      if (circles.length >= MAX_CIRCLES) return;
      circles.push({
        x: pos.x, y: pos.y, r: 30,
        color: `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`
      });
    }
    io.emit('circles', circles);
  });
});
