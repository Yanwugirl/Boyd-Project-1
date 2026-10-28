// Algorithm: linear search. Check every point and keep the best so far.
let pts = [];

function setup() {
  createCanvas(400, 400);
  for (let i = 0; i < 40; i++) {
    pts.push(createVector(random(width), random(height)));
  }
}

function draw() {
  background(245);
  let m = createVector(mouseX, mouseY);
  let best = null;
  let bestD = Infinity;

  for (let p of pts) {
    noStroke();
    fill(120);
    ellipse(p.x, p.y, 8);
    let d = p5.Vector.dist(m, p);         // distance from the mouse to this point
    if (d < bestD) {                      // keep the closest so far
      bestD = d;
      best = p;
    }
  }

  stroke(200, 40, 40);
  strokeWeight(2);
  line(mouseX, mouseY, best.x, best.y);
  noStroke();
  fill(200, 40, 40);
  ellipse(best.x, best.y, 14);
}
