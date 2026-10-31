/* Hand tracking follows the official p5/ml5 tutorial linked in SOURCES.md.
 * Added here: mirrored screen mapping, dwell, release-to-rearm, loss-of-hand pause.
 */
'use strict';
window.GestureInput = (() => {
  let model, video, stream, enabled = false, generation = 0, loading = false;
  let frame, target = null, start = 0, latched = false, lastSeen = 0, pointer;
  const cursor = () => document.getElementById('hand-cursor');
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script'); tag.src = url;
      tag.onload = resolve; tag.onerror = () => reject(new Error('The hand library could not load. Check your internet connection.'));
      document.head.append(tag);
    });
  }
  function reset() {
    target?.classList.remove('gesture-hover'); target = null; start = 0; latched = false;
    document.getElementById('dwell-ring').style.strokeDashoffset = '138.23';
  }
  function stop() {
    enabled = false; generation += 1; cancelAnimationFrame(frame); reset(); cursor().hidden = true;
    try { model?.detectStop(); } catch {}
    stream?.getTracks().forEach(t => t.stop()); stream = null;
    video?.remove(); video = null;
    document.getElementById('camera-toggle').textContent = '✋ Use my hand';
  }
  async function startTracking({ onPoint, onStatus, dwellMs = 1500 }) {
    if (loading) return;
    if (enabled) { stop(); onStatus('Hand input paused. You can still choose with a mouse.'); return; }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      onStatus('Camera input needs localhost or an HTTPS address. Mouse input is available here.'); return;
    }
    loading = true;
    const current = ++generation;
    try {
      onStatus('Loading hand tracking… This may take a moment the first time.');
      if (!window.ml5) await loadScript('https://unpkg.com/ml5@1.3.1/dist/ml5.min.js');
      if (current !== generation) return;
      if (!model) model = await ml5.handPose({ flipped: true, maxHands: 1 });
      if (current !== generation) return;
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      if (current !== generation) { stream.getTracks().forEach(t => t.stop()); return; }
      video = document.createElement('video'); video.muted = true; video.playsInline = true;
      video.style.cssText = 'position:fixed;left:-10000px;width:640px;height:480px';
      document.body.append(video); video.srcObject = stream; await video.play();
      enabled = true; lastSeen = 0;
      model.detectStart(video, results => {
        const hand = results[0]; const tip = hand?.keypoints?.[8];
        if (!tip || (Number.isFinite(hand.confidence) && hand.confidence < .65)) return;
        // ml5's flipped option already mirrors x. Do not mirror a second time.
        pointer = { x: Math.min(.98, Math.max(.02, tip.x / (video.videoWidth || 640))), y: Math.min(.98, Math.max(.02, tip.y / (video.videoHeight || 480))) };
        lastSeen = performance.now();
      });
      document.getElementById('camera-toggle').textContent = '✋ Pause hand';
      let lost = true;
      function tick(now) {
        if (!enabled) return;
        const visible = now - lastSeen < 350 && pointer;
        cursor().hidden = !visible;
        if (!visible) {
          reset();
          if (!lost) { onStatus('Hand lost. Selection paused; hold your hand in front of the camera.'); lost = true; }
        } else {
          if (lost) { onStatus('Point at a line and hold for 1.5 seconds. Move away before choosing again.'); lost = false; }
          const x = pointer.x * innerWidth, y = pointer.y * innerHeight;
          cursor().style.left = `${x}px`; cursor().style.top = `${y}px`; onPoint(pointer);
          const element = document.elementFromPoint(x, y)?.closest('[data-gesture]');
          const next = element && !element.disabled && element.getClientRects().length ? element : null;
          if (next !== target) { reset(); target = next; start = now; target?.classList.add('gesture-hover'); }
          if (target && !latched) {
            const progress = Math.min(1, (now - start) / dwellMs);
            document.getElementById('dwell-ring').style.strokeDashoffset = String(138.23 * (1 - progress));
            if (progress >= 1) { latched = true; target.click(); }
          }
        }
        frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
    } catch (error) {
      stop();
      onStatus(error.name === 'NotAllowedError' ? 'Camera access was declined. You can choose phrases with a mouse.' : error.message || 'Hand tracking could not start. Mouse input is still available.');
    } finally { loading = false; }
  }
  window.addEventListener('pagehide', stop);
  return { toggle: startTracking, stop };
})();
