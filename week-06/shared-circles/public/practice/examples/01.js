// A variable holds a value. A conditional picks a branch each frame.
let size = 60;

function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(240);
  let x = mouseX;                       // read the mouse every frame
  if (x < width / 2) {
    fill(200, 60, 60);                  // left half: red
  } else {
    fill(60, 60, 200);                  // right half: blue
  }
  ellipse(x, height / 2, size);
}
