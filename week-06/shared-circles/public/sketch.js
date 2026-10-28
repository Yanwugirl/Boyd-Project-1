// The browser sends clicks; the server sends the authoritative circles.
const socket = io();
let circles = [];
socket.on('circles', (data) => { circles = data; });

function updateConnection() {
  const transport = socket.io.engine?.transport?.name || 'connecting';
  document.getElementById('connection').textContent = socket.connected
    ? `Connected via ${transport}` : 'Disconnected — reconnecting…';
}
socket.on('connect', () => {
  updateConnection();
  socket.io.engine.on('upgrade', updateConnection);
});
socket.on('disconnect', updateConnection);
socket.on('connect_error', updateConnection);

function setup() { createCanvas(windowWidth, windowHeight); }
function draw() {
  background(220);
  noStroke();
  for (const c of circles) {
    fill(c.color);
    circle(c.x, c.y, c.r * 2);
  }
  noFill();
  stroke(0);
  circle(mouseX, mouseY, 60);
}
function mousePressed(event) {
  // Clicking the navigation links should not also add a circle.
  if (event?.target?.tagName !== 'CANVAS' || !socket.connected) return;
  if (mouseX >= 0 && mouseY >= 0 && mouseX < width && mouseY < height) {
    socket.emit('click', { x: mouseX, y: mouseY });
  }
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); }
