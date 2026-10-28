// A signal is a stream of samples. Keep a history and draw it.
let raw = [];
let smooth = [];
let s = 0;

function setup() {
  createCanvas(400, 400);
  textSize(14);
}

function draw() {
  background(245);
  let sample = noise(frameCount * 0.02) * height;   // stand-in for a sensor
  s = lerp(s, sample, 0.1);                         // a simple smoothing filter
  raw.push(sample);
  smooth.push(s);
  if (raw.length > width) {               // keep only the last 400 samples
    raw.shift();
    smooth.shift();
  }

  noFill();
  stroke(170);
  strokeWeight(1);
  beginShape();
  for (let i = 0; i < raw.length; i++) vertex(i, height - raw[i]);
  endShape();

  stroke(200, 40, 40);
  strokeWeight(2);
  beginShape();
  for (let i = 0; i < smooth.length; i++) vertex(i, height - smooth[i]);
  endShape();

  noStroke();
  fill(120);
  text('grey: raw   red: smoothed', 12, 22);
}
