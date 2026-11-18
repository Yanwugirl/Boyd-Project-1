/* Hand tracking follows the official p5/ml5 handPose tutorial linked in SOURCES.md.
 * Added here: mirrored screen mapping, dwell, release-to-rearm, loss-of-hand pause,
 * and (new) onHand: all 21 hand keypoints, so a scene can draw an abstract, hand-styled
 * outline and send it to the other player. Raw video is never shown or sent.
 */
'use strict';
window.GestureInput = (() => {
  let model, video, stream, enabled = false, generation = 0, loading = false;
  let frame, target = null, start = 0, latched = false, lastSeen = 0, pointer, handPoints = null;
  let handCallback = null, fresh = false;
  const frameCanvas = document.createElement('canvas');
  const frameContext = frameCanvas.getContext('2d', { willReadFrequently: false });
  // Hand detection is the heaviest work on the page, so it runs about 15 times a second, not on every frame.
  const DETECT_EVERY_MS = 66;
  // The middle of the camera image covers the whole screen, so you can reach every edge without leaving the frame.
  const REACH = .14;
  const reach = value => Math.min(1, Math.max(0, (value - REACH) / (1 - REACH * 2)));
  // Light smoothing: ml5's keypoints shake a little from frame to frame. A small blend keeps the light readable
  // while a real tremble of the hand still shows.
  const SMOOTH = .45;
  const cursor = () => document.getElementById('hand-cursor');

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script'); tag.src = url;
      tag.onload = resolve;
      tag.onerror = () => reject(new Error('The hand library could not load. Check your internet connection.'));
      document.head.append(tag);
    });
  }

  function reset() {
    target?.classList.remove('gesture-hover'); target = null; start = 0; latched = false;
    const ring = document.getElementById('dwell-ring');
    if (ring) ring.style.strokeDashoffset = '138.23';
  }

  function stop() {
    const wasRunning = enabled;
    enabled = false; generation += 1; cancelAnimationFrame(frame); reset();
    document.body.classList.remove('hand-on');
    if (cursor()) cursor().hidden = true;
    // Let ml5 finish the frame it is reading before the camera and its video go away.
    // Removing them mid-frame broke ml5's loop, which froze the page and stopped the hand from starting again.
    const oldStream = stream, oldVideo = video;
    stream = null; video = null;
    setTimeout(() => { oldStream?.getTracks().forEach(t => t.stop()); oldVideo?.remove(); }, wasRunning ? 400 : 0);
    pointer = null; handPoints = null;
    if (handCallback) { try { handCallback(null); } catch {} }
    handCallback = null;
    const toggle = document.getElementById('camera-toggle');
    if (toggle && toggle.querySelector('svg') === null) toggle.textContent = '✋ Use my hand';
  }

  async function startTracking({ onPoint, onStatus, onHand = null, dwellMs = 1500, instructions = 'Point at a line and hold for 1.5 seconds. Move away before choosing again.' }) {
    if (loading) return;
    if (enabled) { stop(); onStatus('Hand input paused. You can still choose with a mouse.'); return; }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      onStatus('Camera input needs localhost or an HTTPS address. Mouse input is available here.'); return;
    }
    loading = true;
    const current = ++generation;
    try {
      onStatus('Loading hand tracking… This may take a moment the first time. It needs graphics acceleration (GPU) turned on in the browser.');
      if (!window.ml5) await loadScript('https://unpkg.com/ml5@1.3.1/dist/ml5.min.js');
      if (current !== generation) return;
      // ml5.handPose() may hand back the model or a promise of it; await covers both.
      // The 'lite' model is quicker and accurate enough for one fingertip.
      if (!model) model = await ml5.handPose({ flipped: true, maxHands: 1, modelType: 'lite' });
      if (typeof model?.ready?.then === 'function') await model.ready; // wait until the model has really loaded
      if (current !== generation) return;
      // Without graphics acceleration the browser falls back to the 'cpu' backend: every detection takes
      // about half a second and returns empty (NaN) positions. Say so and keep the mouse, instead of freezing the page.
      const backend = (() => { try { return (ml5.tf || window.tf)?.getBackend?.() || ''; } catch { return ''; } })();
      if (backend === 'cpu') {
        onStatus('Hand tracking needs graphics acceleration, which is off in this browser. Turn on “Use graphics acceleration when available” in the browser’s System settings and restart it, or use Chrome. The mouse works for now.');
        stop(); return;
      }
      if (current !== generation) return;
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      if (current !== generation) { stream.getTracks().forEach(t => t.stop()); return; }
      video = document.createElement('video'); video.muted = true; video.playsInline = true;
      // Keep the video inside the window but invisible. Browsers pause muted videos that sit off-screen,
      // which froze the camera image, so the hand was never found.
      video.style.cssText = 'position:fixed;left:0;top:0;width:160px;height:120px;opacity:0;pointer-events:none;z-index:-1';
      document.body.append(video); video.srcObject = stream; await video.play();
      enabled = true; lastSeen = 0; handCallback = onHand;
      document.body.classList.add('hand-on');
      // Our own detection loop: one frame at a time, at a steady pace, and it ends cleanly when the hand is paused.
      const detectLoop = async () => {
        if (current !== generation || !enabled) return;
        const started = performance.now();
        try {
          // Copy the camera frame onto a canvas and detect on that. Some browsers (Edge with WebGPU) read
          // nothing from a <video> directly, so the model saw empty frames and never found a hand.
          if (video && video.readyState >= 2 && video.videoWidth) {
            if (frameCanvas.width !== video.videoWidth) { frameCanvas.width = video.videoWidth; frameCanvas.height = video.videoHeight; }
            frameContext.drawImage(video, 0, 0, frameCanvas.width, frameCanvas.height);
            handleResults(await model.detect(frameCanvas));
          }
        } catch {}
        if (current === generation && enabled) setTimeout(detectLoop, Math.max(10, DETECT_EVERY_MS - (performance.now() - started)));
      };
      const handleResults = results => {
        if (current !== generation || !enabled) return; // results from a stopped run
        const hand = results?.[0];
        const tip = hand?.keypoints?.[8];
        // Ignore broken results: positions that are not numbers would move the light to nowhere.
        if (!tip || !Number.isFinite(tip.x) || !Number.isFinite(tip.y)) return;
        if (Number.isFinite(hand.confidence) && hand.confidence < .65) return;
        const width = frameCanvas.width || 640, height = frameCanvas.height || 480;
        // ml5's flipped option already mirrors x. Do not mirror a second time.
        const raw = { x: reach(tip.x / width), y: reach(tip.y / height) };
        const fresh = !pointer || performance.now() - lastSeen > 350;
        pointer = fresh ? raw : { x: pointer.x + (raw.x - pointer.x) * SMOOTH, y: pointer.y + (raw.y - pointer.y) * SMOOTH };
        // The outline moves with the smoothed fingertip, keeping the hand's own shape.
        const dx = pointer.x - raw.x, dy = pointer.y - raw.y;
        handPoints = hand.keypoints.length === 21 ? hand.keypoints.map(k => ({ x: reach(k.x / width) + dx, y: reach(k.y / height) + dy })) : null;
        lastSeen = performance.now(); fresh = true;
      };
      detectLoop();
      const toggle = document.getElementById('camera-toggle');
      if (toggle && toggle.querySelector('svg') === null) toggle.textContent = '✋ Pause hand';
      let lost = true;
      onStatus('Camera on. Hold one hand up in front of the camera.');
      function tick(now) {
        if (!enabled) return;
        const visible = now - lastSeen < 350 && pointer;
        if (cursor()) cursor().hidden = !visible;
        if (!visible) {
          reset();
          if (!lost) {
            onStatus('Hand lost. Selection paused; hold your hand in front of the camera.');
            handCallback?.(null);
            lost = true;
          }
        } else {
          if (lost) { onStatus(instructions); lost = false; }
          const x = pointer.x * innerWidth, y = pointer.y * innerHeight;
          if (cursor()) { cursor().style.left = `${x}px`; cursor().style.top = `${y}px`; }
          // Hand the scene new positions only when a new detection has arrived.
          if (fresh) { fresh = false; onPoint(pointer); if (handPoints) handCallback?.(handPoints); }
          const element = document.elementFromPoint(x, y)?.closest('[data-gesture]');
          const next = element && !element.disabled && element.getClientRects().length ? element : null;
          if (next !== target) { reset(); target = next; start = now; target?.classList.add('gesture-hover'); }
          if (target && !latched) {
            const progress = Math.min(1, (now - start) / dwellMs);
            const ring = document.getElementById('dwell-ring');
            if (ring) ring.style.strokeDashoffset = String(138.23 * (1 - progress));
            if (progress >= 1) { latched = true; target.click(); }
          }
        }
        frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
    } catch (error) {
      stop();
      onStatus(error.name === 'NotAllowedError' ? 'Camera access was declined. You can choose with a mouse.' : error.message || 'Hand tracking could not start. Mouse input is still available.');
    } finally { loading = false; }
  }

  window.addEventListener('pagehide', stop);
  // Any scene can read where the hand is right now, whichever page or act turned the camera on.
  const visibleNow = () => enabled && pointer && performance.now() - lastSeen < 350;
  return {
    toggle: startTracking, stop,
    get active() { return enabled; }, get loading() { return loading; },
    get point() { return visibleNow() ? { ...pointer } : null; },
    get hand() { return visibleNow() && handPoints ? handPoints.map(p => ({ ...p })) : null; }
  };
})();
