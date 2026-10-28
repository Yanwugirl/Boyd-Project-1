let positions = [200, 200, 200];
const factors = [0.02, 0.08, 0.5];
function setup() { createCanvas(400, 400); textSize(14); }
function draw() {
  background(245);
  for (let i = 0; i < factors.length; i++) {
    positions[i] = lerp(positions[i], mouseX, factors[i]);
    fill(i === 0 ? color(60, 100, 220) : i === 1 ? color(200, 60, 60) : color(40, 150, 90));
    circle(positions[i], 100 + i * 100, 45);
    fill(30); text('lerp factor ' + factors[i], 12, 70 + i * 100);
  }
}
