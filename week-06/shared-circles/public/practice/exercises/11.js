// A system: many simple objects, each with forces, updated every frame.
let parts = [];
const gravity = 0.15;                     // a force applied every frame

class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(1, 4));
    this.life = 255;
  }

  update() {
    this.vel.add(createVector(0, gravity));   // force changes velocity
    this.pos.add(this.vel);                   // velocity changes position
    this.life -= 3;                           // fade out
  }

  show() {
    noStroke();
    fill(220, 80, 60, this.life);
    ellipse(this.pos.x, this.pos.y, 10);
  }

  dead() {
    return this.life <= 0;
  }
}

function setup() {
  createCanvas(400, 400);
  textSize(14);
}

function draw() {
  noStroke();
  fill(30, 30, 40, 40);                   // translucent wash leaves trails
  rect(0, 0, width, height);

  for (let p of parts) {
    p.update();
    p.show();
  }
  parts = parts.filter(p => !p.dead());  // drop particles that have faded
  fill(255);
  text('particles: ' + parts.length, 10, 20);
}

function mousePressed() {
  for (let i = 0; i < 30; i++) parts.push(new Particle(mouseX, mouseY));
}
