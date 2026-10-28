function setup() { createCanvas(windowWidth, windowHeight); }
function draw() {
  background(220);
  noStroke();
  fill(255, 0, 0);
  circle(mouseX, mouseY, 50);
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); }
