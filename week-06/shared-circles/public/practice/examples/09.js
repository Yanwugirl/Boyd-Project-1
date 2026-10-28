// 3D is the same loop with a third axis. WEBGL mode turns it on.
function setup() {
  createCanvas(400, 400, WEBGL);
}

function draw() {
  background(245);
  orbitControl();                         // drag to orbit the camera
  rotateY(frameCount * 0.005);            // turn the whole scene
  noStroke();
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      let h = noise(gx * 0.5 + 10, gz * 0.5, frameCount * 0.01) * 150 + 10;
      push();
      translate(gx * 50, 0, gz * 50);
      fill(60 + h, 120, 200);
      box(40, h, 40);
      pop();
    }
  }
}
