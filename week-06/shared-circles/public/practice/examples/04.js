// A class bundles data (position, speed) with behaviour (update, show).
class Walker {
  constructor(x, y, c) {
    this.x = x;
    this.y = y;
    this.vx = random(-2, 2);
    this.vy = random(-2, 2);
    this.c = c;
  }

  update() {                              // runs once per frame
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > width) this.vx *= -1;    // bounce off the sides
    if (this.y < 0 || this.y > height) this.vy *= -1;
  }

  show() {
    fill(this.c);
    ellipse(this.x, this.y, 30);
  }
}

let walkers = [];

function setup() {
  createCanvas(400, 400);
  for (let i = 0; i < 8; i++) {
    walkers.push(new Walker(random(width), random(height), color(random(255), 120, 200)));
  }
}

function draw() {
  background(245);
  for (let w of walkers) {
    w.update();
    w.show();
  }
}
