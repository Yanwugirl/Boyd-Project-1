// Shared XP/AIM pieces for Acts II and III: stylesheet, taskbar, and window frames.
export function useAimTheme(role) {
  if (role !== 'human') return; // only Player 1 gets the AIM look
  if (!document.querySelector('link[data-aim-theme]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = '/acts/aim-theme.css?v=aim1'; link.dataset.aimTheme = '';
    document.head.append(link);
  }
  document.body.dataset.player = role; // human = Player 1, robot = Player 2
  const bar = document.querySelector('.stage-bottom');
  if (!bar || bar.querySelector('.aim-start')) return;
  const make = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text || '' });
  const clock = make('span', 'aim-clock');
  const tick = () => { clock.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  tick(); setInterval(tick, 15000);
  const tray = make('div', 'aim-tray');
  // Move the existing connection text and leave button into the tray; experience.js still finds them by id
  tray.append(document.getElementById('stage-connection'), document.getElementById('stage-leave'), clock);
  bar.prepend(make('span', 'aim-start', 'start'));
  bar.append(tray);
}

export function windowFrame(title, child, className = '') {
  const frame = document.createElement('section');
  frame.className = `aim-window ${className}`.trim();
  const bar = document.createElement('header');
  bar.className = 'aim-titlebar';
  const icon = Object.assign(document.createElement('i'), { className: 'aim-icon' });
  const text = Object.assign(document.createElement('span'), { className: 'aim-title', textContent: title });
  const controls = Object.assign(document.createElement('span'), { className: 'aim-controls', innerHTML: '<b>_</b><b>□</b><b class="x">×</b>' });
  controls.setAttribute('aria-hidden', 'true');
  bar.append(icon, text, controls);
  const body = Object.assign(document.createElement('div'), { className: 'aim-window-body' });
  body.append(child);
  frame.append(bar, body);
  return frame;
}

export function setTitle(frame, text) {
  const node = frame.querySelector('.aim-title');
  if (node && node.textContent !== text) node.textContent = text;
}
