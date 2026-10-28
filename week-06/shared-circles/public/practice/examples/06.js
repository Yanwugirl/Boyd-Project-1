// map() rescales a value from one range to another.
// lerp() moves a fraction of the way from a to b: easing.
let x = 200;

function setup() {
  createCanvas(400, 400);
  textSize(14);
}

function draw() {
  background(245);
  x = lerp(x, mouseX, 0.08);              // ease 8% of the way each frame
  let hue = map(x, 0, width, 0, 255);     // rescale 0..400 to 0..255
  noStroke();
  fill(0);
  ellipse(mouseX, 90, 10);                // the target
  fill(hue, 90, 220);
  ellipse(x, height / 2, 80);             // the eased position
  fill(40);
  text('mapped value: ' + nf(hue, 1, 0), 16, 30);
}
