import './styles.css';

const app = document.querySelector('#app');
const zone = document.querySelector('#touchZone');
const emptyState = document.querySelector('#emptyState');
const headline = document.querySelector('#headline');
const subhead = document.querySelector('#subhead');
const eyebrow = document.querySelector('#eyebrow');
const statusText = document.querySelector('#statusText');
const confetti = document.querySelector('#confetti');
const dialog = document.querySelector('#installDialog');

const colors = [
  ['#ff5c5c', '#d93662'],
  ['#ffcc4d', '#f28431'],
  ['#55d6be', '#199b92'],
  ['#8b7cf6', '#5b4bc4'],
  ['#6cc5ff', '#337dc2'],
  ['#ff8dc7', '#c63e87'],
  ['#b9e769', '#659c2d']
];

const touches = new Map();
let colorIndex = 0;
let armTimer = null;
let countdownTimer = null;
let countdown = 3;
let winnerId = null;
let audioContext = null;
let offlineState = 'checking';

function idleStatus() {
  if (offlineState === 'ready') return 'OFFLINE READY';
  if (offlineState === 'insecure') return 'HTTPS NEEDED FOR OFFLINE';
  if (offlineState === 'unsupported') return 'OFFLINE UNAVAILABLE';
  return 'READY WHEN YOU ARE';
}

function vibrate(pattern) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

function visualTap(strength = 'soft') {
  app.classList.remove('tap-soft', 'tap-strong');
  void app.offsetWidth;
  app.classList.add(strength === 'strong' ? 'tap-strong' : 'tap-soft');
}

function blip(frequency = 220, duration = 0.08) {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.055, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Sound is a best-effort fallback for devices without vibration. */ }
}

function fingerElement(pointerId, x, y) {
  const [main, shadow] = colors[colorIndex++ % colors.length];
  const element = document.createElement('div');
  element.className = 'finger';
  element.dataset.pointer = pointerId;
  element.style.setProperty('--x', `${x}px`);
  element.style.setProperty('--y', `${y}px`);
  element.style.setProperty('--finger', main);
  element.style.setProperty('--finger-shadow', shadow);
  element.innerHTML = '<span class="finger-ring"></span><span class="finger-face"><i></i><i></i><b></b></span>';
  app.append(element);
  requestAnimationFrame(() => element.classList.add('is-in'));
  return element;
}

function setCopy(state, value) {
  if (state === 'ready') {
    eyebrow.textContent = 'THE TINIEST DECISION MAKER';
    headline.innerHTML = 'Put your<br /><em>fingers</em> down';
    subhead.innerHTML = 'Two or more, please. Hold still<br />and let fate do its thing.';
    statusText.textContent = idleStatus();
  } else if (state === 'one') {
    eyebrow.textContent = 'ONE BRAVE FINGER';
    headline.innerHTML = 'Needs a little<br /><em>company</em>';
    subhead.innerHTML = 'Add at least one more finger<br />to make it a proper dilemma.';
    statusText.textContent = 'WAITING FOR A FRIEND';
  } else if (state === 'armed') {
    eyebrow.textContent = `${touches.size} CONTENDERS ENTERED`;
    headline.innerHTML = 'Everybody<br /><em>hold still…</em>';
    subhead.innerHTML = 'No wiggling. No bargaining.<br />The choosing is about to begin.';
    statusText.textContent = 'FEELING THE VIBES';
  } else if (state === 'countdown') {
    eyebrow.textContent = 'FATE IS THINKING';
    headline.innerHTML = `<span class="count-number">${value}</span>`;
    subhead.innerHTML = 'Keep those fingies planted.';
    statusText.textContent = 'CHOOSING VERY SCIENTIFICALLY';
  } else if (state === 'winner') {
    eyebrow.textContent = 'THE UNIVERSE HAS SPOKEN';
    headline.innerHTML = 'This one!<br /><em>It’s you.</em>';
    subhead.innerHTML = 'Lift all fingers to play again.';
    statusText.textContent = 'A WINNER APPEARS';
  }
}

function clearTimers() {
  clearTimeout(armTimer);
  clearInterval(countdownTimer);
  armTimer = null;
  countdownTimer = null;
}

function resetCountdown() {
  clearTimers();
  document.body.classList.remove('is-counting');
  if (winnerId !== null) return;
  if (touches.size === 0) setCopy('ready');
  else if (touches.size === 1) setCopy('one');
  else armChoice();
}

function armChoice() {
  clearTimers();
  setCopy('armed');
  armTimer = setTimeout(startCountdown, 850);
}

function startCountdown() {
  if (touches.size < 2 || winnerId !== null) return;
  countdown = 3;
  document.body.classList.add('is-counting');
  setCopy('countdown', countdown);
  vibrate(18);
  blip(210);
  countdownTimer = setInterval(() => {
    countdown -= 1;
    if (countdown > 0) {
      setCopy('countdown', countdown);
      vibrate(18);
      blip(210 + (3 - countdown) * 70);
      headline.animate([{ transform: 'scale(.82)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
    } else {
      clearTimers();
      chooseWinner();
    }
  }, 720);
}

function chooseWinner() {
  const ids = [...touches.keys()];
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  winnerId = ids[random[0] % ids.length];
  document.body.classList.remove('is-counting');
  document.body.classList.add('has-winner');
  touches.forEach((touch, id) => touch.element.classList.toggle('is-winner', id === winnerId));
  setCopy('winner');
  vibrate([55, 45, 110]);
  visualTap('strong');
  blip(520, .12);
  setTimeout(() => blip(720, .18), 100);
  burst();
}

function burst() {
  confetti.replaceChildren();
  const winner = touches.get(winnerId);
  if (!winner) return;
  for (let i = 0; i < 28; i += 1) {
    const bit = document.createElement('i');
    const angle = (Math.PI * 2 * i) / 28 + Math.random() * .2;
    const distance = 100 + Math.random() * 150;
    bit.style.setProperty('--cx', `${winner.x}px`);
    bit.style.setProperty('--cy', `${winner.y}px`);
    bit.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
    bit.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
    bit.style.setProperty('--rot', `${Math.random() * 600 - 300}deg`);
    bit.style.setProperty('--delay', `${Math.random() * 120}ms`);
    bit.style.background = colors[i % colors.length][0];
    confetti.append(bit);
  }
}

function localPoint(event) {
  const bounds = app.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function pointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (event.target.closest('button, a, dialog')) return;
  event.preventDefault();
  if (winnerId !== null || touches.has(event.pointerId)) return;
  app.setPointerCapture?.(event.pointerId);
  const point = localPoint(event);
  const element = fingerElement(event.pointerId, point.x, point.y);
  touches.set(event.pointerId, { ...point, element });
  emptyState.classList.add('is-hidden');
  vibrate(12);
  visualTap();
  blip(150 + touches.size * 28, .05);
  resetCountdown();
}

function pointerMove(event) {
  const touch = touches.get(event.pointerId);
  if (!touch || winnerId !== null) return;
  event.preventDefault();
  const point = localPoint(event);
  const moved = Math.hypot(point.x - touch.x, point.y - touch.y) > 18;
  touch.x = point.x;
  touch.y = point.y;
  touch.element.style.setProperty('--x', `${point.x}px`);
  touch.element.style.setProperty('--y', `${point.y}px`);
  if (moved && !countdownTimer) resetCountdown();
}

function pointerUp(event) {
  const touch = touches.get(event.pointerId);
  if (!touch) return;
  touch.element.classList.remove('is-in');
  setTimeout(() => touch.element.remove(), 180);
  touches.delete(event.pointerId);

  if (winnerId !== null) {
    if (touches.size === 0) fullReset();
    return;
  }
  resetCountdown();
  if (touches.size === 0) emptyState.classList.remove('is-hidden');
}

function fullReset() {
  clearTimers();
  winnerId = null;
  document.body.classList.remove('has-winner', 'is-counting');
  confetti.replaceChildren();
  emptyState.classList.remove('is-hidden');
  setCopy('ready');
}

app.addEventListener('pointerdown', pointerDown);
app.addEventListener('pointermove', pointerMove);
app.addEventListener('pointerup', pointerUp);
app.addEventListener('pointercancel', pointerUp);
app.addEventListener('contextmenu', (event) => event.preventDefault());

document.querySelector('#infoButton').addEventListener('click', () => dialog.showModal());
document.querySelector('#closeDialog').addEventListener('click', () => dialog.close());
document.querySelector('#gotIt').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

window.addEventListener('load', async () => {
  if (!window.isSecureContext) {
    offlineState = 'insecure';
    if (touches.size === 0) statusText.textContent = idleStatus();
    return;
  }

  if (!('serviceWorker' in navigator)) {
    offlineState = 'unsupported';
    if (touches.size === 0) statusText.textContent = idleStatus();
    return;
  }

  try {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    offlineState = 'ready';
  } catch {
    offlineState = 'unsupported';
  }
  if (touches.size === 0) statusText.textContent = idleStatus();
});
