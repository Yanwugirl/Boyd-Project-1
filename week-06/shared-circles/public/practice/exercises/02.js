// A loop repeats a step. A nested loop visits every cell of a grid.
function setup() {
  createCanvas(400, 400);
  noStroke();
}

function draw() {
  background(255);
  let cell = max(1, int(map(mouseX, 0, width, 10, 80)));   // mouse sets the cell size
  for (let row = 0; row * cell < height; row++) {
    for (let col = 0; col * cell < width; col++) {
      if ((row + col) % 3 === 0) {
        fill(30);
      } else {
        fill(230);
      }
      rect(col * cell, row * cell, cell, cell);
    }
  }
}
