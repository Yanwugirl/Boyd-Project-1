'use strict';
(() => {
  const $ = id => document.getElementById(id);
  let session, timer, toastTimer, setup, lastRecords = '', loadingTest = false;
  function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500); }
  function endpoint(path, body) { return fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}).then(async r => { const data = await r.json(); if (!r.ok || data.ok === false) throw new Error(data.error || 'Request failed.'); return data; }); }
  function modelHealth() {
    if (!setup) return;
    const found = setup.ollama.models?.some(m => m.name === $('model').value || m.name === `${$('model').value}:latest`);
    $('ollama-dot').className = `status-dot ${setup.ollama.reachable && found ? 'good' : 'bad'}`;
    $('ollama-status').textContent = !setup.ollama.reachable ? 'Not running' : found ? 'Ready' : 'Model not downloaded';
    $('setup-detail').textContent = !setup.ollama.reachable ? 'Open Ollama on this server computer, then click Refresh.' : found ? `Model available: ${$('model').value}` : `Download this model: ollama pull ${$('model').value}`;
    $('test-model').disabled = !found || !setup.ollama.reachable || loadingTest;
    $('model').disabled = $('mode').value !== 'ollama';
  }
  async function refresh() {
    $('refresh').disabled = true;
    try {
      setup = await endpoint('/api/setup');
      $('server-dot').className = 'status-dot good'; $('server-status').textContent = 'Connected'; $('create-session').disabled = false;
      const before = $('model').value; const names = [...new Set([setup.defaultModel, ...(setup.ollama.models || []).map(m => m.name)])];
      $('model').replaceChildren();
      for (const name of names) { const option = document.createElement('option'); option.value = name; option.textContent = name; $('model').append(option); }
      $('model').value = setup.ollama.models?.some(m => m.name === before) ? before : setup.ollama.models?.[0]?.name || setup.defaultModel;
      modelHealth();
    } catch (e) {
      $('server-dot').className = 'status-dot bad'; $('server-status').textContent = 'Not connected'; $('setup-detail').textContent = 'Start the Node server with START_ACT1.cmd, then open http://localhost:3000.';
      $('create-session').disabled = true; $('test-model').disabled = true;
    } finally { $('refresh').disabled = false; }
  }
  async function testModel() {
    loadingTest = true; modelHealth();
    $('model-result').hidden = false; $('model-result').classList.remove('failed'); $('model-result-label').textContent = 'Sending x to local Ollama…'; $('model-output').textContent = 'The first request may take longer while the model loads.';
    try {
      const result = await endpoint('/api/model-test', { model: $('model').value, text: $('test-input').value.trim() });
      $('model-result-label').textContent = `Real Ollama response · ${(result.durationMs / 1000).toFixed(1)} seconds · y`;
      $('model-output').textContent = result.y;
    } catch (e) { $('model-result').classList.add('failed'); $('model-result-label').textContent = 'Model test did not complete'; $('model-output').textContent = e.message; }
    finally { loadingTest = false; modelHealth(); }
  }
  function absolute(path, base = location.origin) { return new URL(path, base).href; }
  function showSession(data) {
    session = data; lastRecords = '';
    $('session').hidden = false; $('record-section').hidden = false;
    $('session-name').textContent = data.room;
    $('session-mode').textContent = data.mode === 'ollama' ? `Ollama · ${data.model}` : data.mode === 'direct' ? 'Direct connection test' : 'Scripted rehearsal';
    $('open-p1').href = data.player1; $('open-p2').href = data.player2; $('open-split').href = data.split;
    $('lan-links').replaceChildren();
    for (const origin of data.lanAddresses || []) {
      const line = document.createElement('p'); line.style.marginBottom = '14px';
      for (const [title, path] of [['Player 1', data.player1], ['Player 2', data.player2]]) { const a = document.createElement('a'); a.href = absolute(path, origin); a.textContent = `${title}: ${a.href}`; a.target = '_blank'; a.rel = 'noopener'; line.append(a); }
      $('lan-links').append(line);
    }
    try { sessionStorage.setItem('act1-test-session', JSON.stringify(data)); } catch {}
    clearInterval(timer); poll(); timer = setInterval(poll, 1300);
  }
  async function createSession() {
    $('create-session').disabled = true; $('create-error').textContent = '';
    try {
      const result = await endpoint('/api/sessions', { mode: $('mode').value, model: $('model').value });
      showSession(result); $('session').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { $('create-error').textContent = e.message; }
    finally { $('create-session').disabled = false; }
  }
  async function poll() {
    if (!session) return;
    try {
      const r = await fetch(`/api/sessions/${encodeURIComponent(session.room)}/inspect`, { headers: { 'x-act1-host-token': session.hostToken } });
      if (!r.ok) { clearInterval(timer); $('phase-label').textContent = 'This test session has expired or the server restarted. Create a new session.'; return; }
      const data = await r.json();
      for (const p of data.players) { $(`p${p.player}-dot`).className = `status-dot ${p.connected ? 'good' : ''}`; $(`p${p.player}-state`).textContent = p.connected ? `Connected · ${p.sent} sent${p.ready ? ' · ready' : ''}` : 'Not connected'; }
      $('processing').hidden = !data.busy;
      $('processing').textContent = data.pending ? `Interpreting Player ${data.pending.from === 'human' ? 1 : 2}'s message…` : 'Interpreting a message…';
      $('phase-label').textContent = data.phase === 'act1-ended' ? 'Act I complete. Both players chose to continue.' : 'Act I in progress. Each player sends at least two messages, then both choose Continue together.';
      const signature = JSON.stringify(data.messages);
      if (signature !== lastRecords) {
        lastRecords = signature; $('records').replaceChildren();
        if (!data.messages.length) { const p = document.createElement('p'); p.className = 'empty-record'; p.textContent = 'Send a message from either player to see its journey here.'; $('records').append(p); }
        for (const m of data.messages) {
          const record = document.createElement('article'); record.className = 'record';
          const meta = document.createElement('div'); meta.className = 'record-meta'; meta.textContent = `Player ${m.player} → Player ${m.player === 1 ? 2 : 1} · ${m.engine}${m.durationMs !== undefined ? ` · ${(m.durationMs / 1000).toFixed(1)}s` : ''}`;
          const body = document.createElement('div'); body.className = 'record-body';
          for (const [label, text] of [['x · Original words', m.x], ['y · Delivered words', m.y]]) { const col = document.createElement('div'); const title = document.createElement('strong'); title.textContent = label; const p = document.createElement('p'); p.textContent = text; col.append(title, p); body.append(col); }
          record.append(meta, body); $('records').append(record);
        }
      }
    } catch { $('phase-label').textContent = 'Connection to the test server paused.'; }
  }
  async function copyLink(field) { if (!session) return; const link = absolute(session[field]); try { await navigator.clipboard.writeText(link); toast('Player link copied.'); } catch { toast(link); } }
  $('refresh').addEventListener('click', refresh); $('model').addEventListener('change', modelHealth); $('mode').addEventListener('change', modelHealth);
  $('test-model').addEventListener('click', testModel); $('create-session').addEventListener('click', createSession);
  $('copy-p1').addEventListener('click', () => copyLink('player1')); $('copy-p2').addEventListener('click', () => copyLink('player2'));
  refresh();
  try { const saved = JSON.parse(sessionStorage.getItem('act1-test-session')); if (saved?.room && saved?.hostToken) showSession(saved); } catch {}
  window.addEventListener('pagehide', () => clearInterval(timer));
})();
