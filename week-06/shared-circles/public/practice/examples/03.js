// A function names a step so you can reuse it.
function drawDot(x, y, r, c) {
  fill(c);
  ellipse(x, y, r * 2);
}

// A function can also return a value.
function avgBright(c) {
  return (red(c) + green(c) + blue(c)) / 3;
}

function setup() {
  createCanvas(400, 400);
  noStroke();
}

function draw() {
  background(250);
  for (let i = 0; i < 8; i++) {
    let c = color(i * 30, 120, 255 - i * 30);
    let x = 50 + i * 40;
    let y = 200 + sin(frameCount * 0.05 + i) * 80;
    drawDot(x, y, 10 + avgBright(c) / 20, c);
  }
}
