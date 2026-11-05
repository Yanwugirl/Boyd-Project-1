'use strict';
window.Experience = (() => {
  const $ = id => document.getElementById(id);
  let state, socket, scene, sceneAct, loading, manifest, sentTransition = '', releaseTimer, destroyed = false, revealedAct = '';
  let sceneGeneration = 0, revision = 0;
  function loadP5() {
    if (window.p5) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = '/vendor/p5/p5.min.js'; tag.onload = resolve;
      tag.onerror = () => { tag.remove(); reject(new Error('The shared space could not load. Please try again.')); };
      document.head.append(tag);
    });
  }
  function transitionText() {
    const t = state?.journey?.transition;
    if (!state?.paired) return 'Waiting for your partner to reconnect. Your room is still here.';
    if (!t) return 'Opening your shared space…';
    if (Object.values(t.loaded).every(Boolean)) return 'Both of you are here.';
    if (t.loaded[state.role]) return 'Your view is ready. Waiting for your partner’s view…';
    return 'Opening the next space for both of you…';
  }
  async function ensureScene() {
    const target = state.journey.transition?.to || state.journey.act;
    if (scene && sceneAct === target) return scene;
    if (loading) return loading;
    scene?.destroy(); scene = null; sceneAct = null;
    const generation = ++sceneGeneration;
    $('transition-retry').hidden = true;
    const pendingLoad = (async () => {
      if (!manifest) manifest = await fetch('/acts/manifest.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('The scene list could not load.'); return r.json(); });
      const act = manifest.acts.find(item => item.id === target);
      if (!act?.enabled || !act.module) throw new Error('This part of the experience is not open yet.');
      await loadP5();
      const module = await import(act.module);
      const mounted = await module.mount({
        host: $('stage-canvas'),
        state,
        emit: (event, value, callback) => {
          if (!socket?.connected) { callback?.({ ok: false, error: 'Reconnecting. Your progress is saved in this room.' }); return; }
          if (!callback) { socket.emit(event, value); return; }
          socket.timeout(8000).emit(event, value, (error, result) => callback(error ? { ok: false, error: 'The connection paused. Please try again.' } : result));
        }
      });
      if (destroyed || generation !== sceneGeneration) { mounted.destroy(); return null; }
      scene = mounted; sceneAct = target;
      $('stage-act').textContent = `${act.number} / ${act.title.toUpperCase()}`;
      $('stage-hint').textContent = act.hint || '';
      $('scene-view').setAttribute('aria-label', act.title);
      scene.update(state); return scene;
    })();
    loading = pendingLoad;
    try { return await pendingLoad; }
    catch (error) {
      if (destroyed || generation !== sceneGeneration) return null;
      $('transition-description').textContent = error.message;
      $('transition-retry').hidden = false;
      return null;
    } finally { if (loading === pendingLoad) loading = null; }
  }
  function reportLoaded() {
    const t = state?.journey?.transition;
    if (!scene || !socket?.connected || !t || state.phase !== t.from + '-ended' || sentTransition === t.id) return;
    sentTransition = t.id;
    socket.timeout(8000).emit('scene:loaded', { act: t.to, transitionId: t.id }, (error, result) => {
      if (error || !result?.ok) {
        sentTransition = '';
        $('transition-description').textContent = result?.error || 'Your connection paused. Reconnect, then try again.';
        $('transition-retry').hidden = false;
      }
    });
  }
  async function update(next, connection) {
    const currentRevision = ++revision;
    state = next; socket = connection;
    if (!state) return;
    if (state.phase === 'act1') {
      clearTimeout(releaseTimer); sceneGeneration += 1;
      scene?.destroy(); scene = null; sceneAct = null; loading = null; sentTransition = ''; revealedAct = '';
      document.body.classList.remove('scene-mode');
      $('scene-view').hidden = true; $('journey-transition').hidden = true;
      $('journey-transition').classList.remove('departing');
      return;
    }
    $('scene-view').hidden = false;
    document.body.classList.add('scene-mode');
    $('transition-description').textContent = transitionText();
    $('stage-connection').textContent = state.phase === 'complete' ? 'Completed together' : state.paired ? 'Connected together' : 'Waiting for your partner to reconnect';
    $('stage-connection').classList.toggle('paused', !state.paired && state.phase !== 'complete');
    if (scene && revealedAct === state.journey.act && !state.phase.endsWith('-ended')) {
      scene.update(state); return;
    }
    $('journey-transition').hidden = false;
    $('journey-transition').classList.remove('departing');
    document.title = 'Between Us · A moment between';
    clearTimeout(releaseTimer);
    const active = await ensureScene();
    if (!active || currentRevision !== revision) return;
    active.update(state);
    if (state.phase.endsWith('-ended')) { reportLoaded(); return; }
    document.title = state.phase === 'complete' ? 'Between Us · Until next time' : `Between Us · ${manifest.acts.find(act => act.id === sceneAct).title}`;
    const remaining = Math.max(0, (state.journey.transition?.startsAt || 0) - (state.serverTime || 0));
    releaseTimer = setTimeout(() => {
      if (destroyed || state.phase.endsWith('-ended')) return;
      $('journey-transition').classList.add('departing');
      releaseTimer = setTimeout(() => {
        $('journey-transition').hidden = true;
        $('journey-transition').classList.remove('departing');
        revealedAct = sceneAct;
      }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 800);
    }, remaining);
  }
  function updateStage(data) {
    if (!scene || data.act !== state?.journey?.act) return;
    if (state.journey && data.positions) state.journey.stage = { positions: data.positions };
    if (data.game) state.act2 = data.game;
    scene.updateStage(data);
  }
  function disconnected() {
    sentTransition = '';
    if (state) { state.paired = false; scene?.update(state); }
    if (!$('scene-view').hidden && state?.phase !== 'complete') { $('stage-connection').textContent = 'Waiting for your partner to reconnect'; $('stage-connection').classList.add('paused'); }
  }
  function destroy() { destroyed = true; revision += 1; sceneGeneration += 1; clearTimeout(releaseTimer); scene?.destroy(); scene = null; }
  $('transition-retry').addEventListener('click', () => { sentTransition = ''; update(state, socket); });
  $('stage-leave').addEventListener('click', () => { socket?.disconnect(); destroy(); location.href = '/'; });
  return { update, updateStage, disconnected, destroy };
})();
