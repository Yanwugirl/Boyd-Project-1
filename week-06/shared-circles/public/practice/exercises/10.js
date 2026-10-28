let raw = [], fast = [], slow = [];
let a = 0, b = 0;
function setup() { createCanvas(400, 400); textSize(13); }
function draw() {
  background(245);
  let sample = noise(frameCount * 0.02) * height;
  a = lerp(a, sample, 0.1); b = lerp(b, sample, 0.02);
  raw.push(sample); fast.push(a); slow.push(b);
  if (raw.length > width) { raw.shift(); fast.shift(); slow.shift(); }
  noFill();
  for (let [values, c] of [[raw, color(170)], [fast, color(200,40,40)], [slow, color(40,80,200)]]) {
    stroke(c); beginShape();
    for (let i=0; i<values.length; i++) vertex(i, height-values[i]);
    endShape();
  }
  noStroke(); fill(30); text('grey raw / red 0.1 / blue 0.02', 10, 20);
}
