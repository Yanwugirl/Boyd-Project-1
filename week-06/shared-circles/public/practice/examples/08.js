// A vector has a direction and a length.
function setup() {
  createCanvas(400, 400);
  textSize(14);
}

function draw() {
  background(245);
  let center = createVector(width / 2, height / 2);
  let m = createVector(mouseX, mouseY);
  let dir = p5.Vector.sub(m, center);     // vector from the centre to the mouse
  let len = dir.mag();                    // its length
  let angle = dir.heading();              // its direction, in radians

  // local coordinates: move the origin to the centre, then turn
  push();
  translate(center.x, center.y);
  rotate(angle);
  stroke(40);
  strokeWeight(3);
  line(0, 0, len, 0);                     // arrow along the local x-axis
  pop();

  // normalise to length 1, then scale to 60 and step out from the centre
  let tip = p5.Vector.add(center, dir.copy().normalize().mult(60));
  noStroke();
  fill(200, 40, 40);
  ellipse(tip.x, tip.y, 12);
  fill(40);
  text('length: ' + nf(len, 1, 0), 16, 24);
}
