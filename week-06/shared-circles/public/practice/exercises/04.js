// A class bundles data (position, speed) with behaviour (update, show).
class Walker {
  constructor(x, y, c) {
    this.x = x;
    this.y = y;
    this.vx = random(-2, 2);
    this.vy = random(-2, 2);
    this.c = c;
    this.size = random(15, 55);
  }

  update() {                              // runs once per frame
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < this.size / 2 || this.x > width - this.size / 2) {
      this.x = constrain(this.x, this.size / 2, width - this.size / 2);
      this.vx = 0;
    }
    if (this.y < this.size / 2 || this.y > height - this.size / 2) {
      this.y = constrain(this.y, this.size / 2, height - this.size / 2);
      this.vy = 0;
    }
  }

  show() {
    fill(this.c);
    ellipse(this.x, this.y, this.size);
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
