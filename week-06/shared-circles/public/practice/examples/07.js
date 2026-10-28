// Pixels are an array: four numbers per pixel (red, green, blue, alpha).
// Index = 4 * (x + y * width).
function setup() {
  createCanvas(300, 300);
  pixelDensity(1);                        // one canvas pixel per array entry
}

function draw() {
  loadPixels();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let i = 4 * (x + y * width);
      let d = dist(x, y, mouseX, mouseY);
      let v = constrain(map(d, 0, 200, 255, 0), 0, 255);  // closer = brighter
      pixels[i]     = v;                  // red
      pixels[i + 1] = x * 255 / width;    // green rises left to right
      pixels[i + 2] = y * 255 / height;   // blue rises top to bottom
      pixels[i + 3] = 255;                // alpha: fully opaque
    }
  }
  updatePixels();
}
