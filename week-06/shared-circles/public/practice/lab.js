const picker = document.getElementById('example');
const editor = document.getElementById('code');
const status = document.getElementById('status');
const frame = document.querySelector('iframe');
let examples = [];
let selected;

fetch('examples.json').then(r => r.json()).then(data => {
  examples = [...data.originals, ...data.exercises];
  for (const item of examples) {
    const option = document.createElement('option');
    option.value = item.id; option.textContent = item.id + ' · ' + item.title;
    picker.append(option);
  }
  picker.addEventListener('change', choose);
  choose();
});
function choose() {
  selected = examples.find(item => item.id === picker.value) || examples[0];
  editor.value = selected.code;
  document.getElementById('reference').textContent = selected.code;
  document.getElementById('title').textContent = selected.title;
  document.getElementById('explanation').textContent = selected.note;
  run();
}
function run() {
  status.className = ''; status.textContent = 'Starting…';
  const safe = editor.value.replace(/<\/script/gi, '<\\/script');
  const prefix = '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}canvas{display:block}</style>'
    + '<script>window.addEventListener("error", e => parent.postMessage({type:"sketch-error",message:e.message},"*"));<\/script>'
    + '<script src="https://cdn.jsdelivr.net/npm/p5@1.9.4/lib/p5.min.js"><\/script></head><body>';
  frame.srcdoc = prefix + '<script>' + safe + '<\/script></body></html>';
}
frame.addEventListener('load', () => {
  if (!status.classList.contains('error')) status.textContent = 'Loaded · move the mouse over the canvas';
});
window.addEventListener('message', event => {
  if (event.source === frame.contentWindow && event.data?.type === 'sketch-error') {
    status.className = 'error'; status.textContent = event.data.message;
  }
});
document.getElementById('run').addEventListener('click', run);
document.getElementById('reset').addEventListener('click', () => { editor.value = selected.code; run(); });
document.getElementById('retype').addEventListener('click', () => { editor.value = ''; editor.focus(); });
editor.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); run(); }
});
