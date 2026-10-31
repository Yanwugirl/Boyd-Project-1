/* Room, person and detachable shell use one set of vector primitives.
 * p5 references: Shape Primitives, Linear Interpolation, noise(). See SOURCES.md.
 * Original scene composition; no finished game or room code was copied.
 */
'use strict';
window.RoomArt = (() => {
  let shared;
  const ready = Promise.all([
    fetch('assets/design-tokens.json').then(r => r.json()),
    fetch('assets/vector-assets.json').then(r => r.json())
  ]).then(([tokens, vectors]) => { shared = { tokens, vectors }; return shared; });

  function drawVector(p, name, x, y, scale = 1) {
    const { tokens, vectors } = shared;
    const asset = vectors.assets[name];
    p.push(); p.translate(x, y); p.scale(scale); p.strokeJoin(p.ROUND); p.strokeCap(p.ROUND);
    for (const shape of asset.shapes) {
      const color = value => tokens.colors[value] || value;
      shape.fill && shape.fill !== 'none' ? p.fill(color(shape.fill)) : p.noFill();
      shape.stroke === 'none' ? p.noStroke() : p.stroke(color(shape.stroke || 'ink'));
      p.strokeWeight(shape.sw ?? 2);
      const a = shape.a;
      if (shape.type === 'rect') p.rect(...a);
      else if (shape.type === 'ellipse') p.ellipse(...a);
      else if (shape.type === 'line') p.line(...a);
      else if (shape.type === 'bezier') p.bezier(...a);
      else if (shape.type === 'poly') { p.beginShape(); for (let i = 0; i < a.length; i += 2) p.vertex(a[i], a[i + 1]); p.endShape(p.CLOSE); }
    }
    p.pop();
  }

  async function mount(elementId, getState = () => ({})) {
    await ready;
    if (!window.p5) throw new Error('p5 could not load. Run npm ci and restart the server.');
    const host = document.getElementById(elementId);
    const { tokens } = shared;
    let observer;
    const sketch = new p5(p => {
      let dust, brightness = 0.35, peer = { x: 0.5, y: 0.5 };
      p.setup = () => {
        p.createCanvas(Math.max(host.clientWidth, 320), Math.max(host.clientWidth, 320) * 760 / 1200);
        p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2)); p.frameRate(30);
        p.noiseSeed(tokens.seed); p.randomSeed(tokens.seed);
        dust = Array.from({ length: 75 }, () => ({ x: p.random(1200), y: p.random(600), z: p.random(300) }));
        observer = new ResizeObserver(entries => {
          const width = entries[0].contentRect.width;
          if (width > 0) p.resizeCanvas(width, width * 760 / 1200);
        });
        observer.observe(host);
      };
      p.draw = () => {
        const state = getState() || {};
        const t = p.millis() * 0.001;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const role = state.role || 'human';
        p.background(tokens.colors.paper); p.push(); p.scale(p.width / 1200);
        drawVector(p, 'room', 0, 0);
        // Window and monitor remain stable across acts. Only light and an optional shell change.
        brightness = p.lerp(brightness, state.busy ? .85 : state.paired ? .55 : .25, .045);
        p.noStroke(); p.fill(245, 229, 180, 14 + 13 * Math.sin(reduced ? 0 : t * .6));
        p.quad(154, 396, 370, 396, 552, 619, 51, 619);
        p.fill(role === 'robot' ? '#c5d6d04d' : '#f0d9a36b');
        p.ellipse(827, 475, 220, 67);
        const bob = reduced ? 0 : Math.sin(t * .8) * 1.4;
        drawVector(p, 'chair', 425, 356);
        drawVector(p, 'person', 445, 265 + bob);
        if (role === 'robot') drawVector(p, 'robot-shell', 445, 265 + bob);
        drawVector(p, 'desk', 0, 0);
        drawVector(p, 'lamp', 784, 328);
        drawVector(p, 'phone', 651, 405);
        p.fill(150, 189, 176, 25 + brightness * 95); p.noStroke();
        p.quad(655, 425, 695, 431, 703, 492, 647, 482);
        drawVector(p, 'mug', 738, 460, .85);
        drawVector(p, 'plant', 161, 480, .92);
        // Soft movement is made with Perlin noise instead of frame-by-frame random jitter.
        for (const point of dust) {
          const dx = reduced ? 0 : (p.noise(point.z, t * .045) - .5) * 19;
          p.fill(80, 84, 74, 18); p.circle(point.x + dx, point.y, 1.5);
        }
        // Both players' real pointer/hand positions influence the thread behind the interface.
        peer.x = p.lerp(peer.x, state.peer?.x ?? .5, .06);
        peer.y = p.lerp(peer.y, state.peer?.y ?? .5, .06);
        const own = state.own || { x: .5, y: .5 };
        p.noFill(); p.stroke(129, 153, 148, state.paired ? 100 : 35); p.strokeWeight(1.6);
        p.bezier(684, 434, 765 + own.x * 35, 357 + own.y * 50, 886 + peer.x * 90, 230 + peer.y * 110, 1134, 330);
        if (state.pulse && !reduced) {
          const age = (Date.now() - state.pulse) / 1800;
          if (age < 1) { p.noFill(); p.stroke(129, 153, 148, (1 - age) * 170); p.circle(680, 457, 22 + age * 85); }
        }
        p.pop();
      };
    }, host);
    return { sketch, destroy() { observer?.disconnect(); sketch.remove(); } };
  }
  return { ready, mount, drawVector };
})();
