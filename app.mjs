import { Garden, Gesture, config, clamp, trailAlpha, visitConnections } from './simulation.mjs';

const canvas = document.querySelector('#garden');
const ctx = canvas.getContext('2d', { alpha: false });
const pauseButton = document.querySelector('#pause');
const motionButton = document.querySelector('#motion');
const status = document.querySelector('#status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const garden = new Garden();
const gesture = new Gesture();
let paused = reducedMotion.matches;
let frame = null, lastTime = null, holdTimer = null;
let motionEnabled = false, motionPending = false, lastAcceleration = null;

const announce = message => { status.textContent = message; };
function draw(clear = false, dt = config.referenceFrameMs) {
  ctx.fillStyle = clear ? '#0e0e10' : `rgba(14,14,16,${trailAlpha(dt)})`;
  ctx.fillRect(0, 0, garden.width, garden.height);
  ctx.lineCap = 'round';
  visitConnections(garden.particles, config.connectRadius * garden.fit, (a, b, distance) => {
    const strength = 1 - distance / (config.connectRadius * garden.fit);
    ctx.beginPath(); ctx.moveTo(a.screenX, a.screenY); ctx.lineTo(b.screenX, b.screenY);
    ctx.strokeStyle = `rgba(${(a.color[0] + b.color[0]) / 2},${(a.color[1] + b.color[1]) / 2},${(a.color[2] + b.color[2]) / 2},${strength * 0.6})`;
    ctx.lineWidth = (0.3 + 2.2 * strength) * Math.max(0.6, garden.fit);
    ctx.stroke();
  });
  for (const p of garden.particles) {
    ctx.beginPath(); ctx.arc(p.screenX, p.screenY, 1.2 * p.scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${p.color.join(',')},0.8)`; ctx.fill();
  }
}
function resize() {
  if (!ctx) return;
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  garden.resize(width, height);
  cancelGesture(); draw(true);
}
function render(timestamp) {
  frame = null;
  if (paused || document.hidden) return;
  const dt = lastTime === null ? 0 : garden.update(timestamp - lastTime);
  lastTime = timestamp;
  if (dt > 0) draw(false, dt);
  frame = requestAnimationFrame(render);
}
function syncLoop() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null; lastTime = null; lastAcceleration = null;
  if (!paused && !document.hidden) frame = requestAnimationFrame(render);
}
function syncPauseButton() {
  pauseButton.textContent = paused ? 'Resume' : 'Pause';
  pauseButton.setAttribute('aria-pressed', String(paused));
}
function cancelGesture() {
  clearTimeout(holdTimer); holdTimer = null;
  const id = gesture.active?.id;
  gesture.cancel();
  if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
}
function applyInteraction(effect) {
  if (effect && !paused && !document.hidden) garden.interact(effect.kind, effect.x, effect.y, effect.dx, effect.dy);
}
const localPoint = e => { const rect = canvas.getBoundingClientRect(); return [e.clientX - rect.left, e.clientY - rect.top]; };
canvas.addEventListener('pointerdown', e => {
  if (paused || e.button !== 0) return;
  // A second touch belongs to browser pinch zoom; cancel the artwork gesture.
  if (gesture.active) { cancelGesture(); return; }
  if (!e.isPrimary) return;
  if (!gesture.start(e.pointerId, ...localPoint(e), performance.now())) return;
  canvas.setPointerCapture(e.pointerId);
  holdTimer = setTimeout(() => applyInteraction(gesture.hold(performance.now())), config.holdMs);
});
canvas.addEventListener('pointermove', e => applyInteraction(gesture.move(e.pointerId, ...localPoint(e))));
canvas.addEventListener('pointerup', e => {
  if (gesture.active?.id !== e.pointerId) return;
  applyInteraction(gesture.move(e.pointerId, ...localPoint(e)));
  applyInteraction(gesture.end(e.pointerId, performance.now()));
  clearTimeout(holdTimer); holdTimer = null;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener('pointercancel', e => { if (gesture.active?.id === e.pointerId) cancelGesture(); });
canvas.addEventListener('lostpointercapture', e => { if (gesture.active?.id === e.pointerId) cancelGesture(); });
window.addEventListener('blur', cancelGesture);
pauseButton.addEventListener('click', () => {
  paused = !paused; cancelGesture(); syncPauseButton(); syncLoop();
  announce(paused ? 'Garden paused.' : 'Garden resumed.');
});
document.querySelector('#reset').addEventListener('click', () => {
  cancelGesture(); garden.reset(); draw(true); syncLoop(); announce('Garden restored.');
});
document.querySelector('#dismiss').addEventListener('click', () => {
  document.querySelector('#hint').hidden = true; pauseButton.focus();
});
reducedMotion.addEventListener('change', e => {
  if (e.matches) {
    paused = true; cancelGesture(); syncPauseButton(); syncLoop();
    announce('Reduced motion is enabled. Resume when you’re ready.');
  }
});
document.addEventListener('visibilitychange', () => { cancelGesture(); syncLoop(); });
window.addEventListener('resize', resize);

function handleMotion(e) {
  if (paused || document.hidden || !motionEnabled) { lastAcceleration = null; return; }
  const acceleration = e.acceleration;
  if (!acceleration || !Number.isFinite(acceleration.x) || !Number.isFinite(acceleration.y)) return;
  const current = { x: acceleration.x, y: acceleration.y };
  if (lastAcceleration) {
    const dx = current.x - lastAcceleration.x, dy = current.y - lastAcceleration.y;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) garden.motion(clamp(dx, -3, 3), clamp(dy, -3, 3));
  }
  lastAcceleration = current;
}
motionButton.addEventListener('click', async () => {
  if (motionPending) return;
  if (motionEnabled) {
    motionEnabled = false; lastAcceleration = null;
    window.removeEventListener('devicemotion', handleMotion);
    motionButton.setAttribute('aria-pressed', 'false'); announce('Device motion off.'); return;
  }
  if (!window.isSecureContext) { announce('Device motion needs a secure connection. Touch controls are ready.'); return; }
  if (typeof DeviceMotionEvent === 'undefined') { announce('Device motion is unavailable. Touch controls are ready.'); return; }
  motionPending = true; motionButton.disabled = true;
  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') { announce('Motion access declined. Touch controls are ready.'); return; }
    }
    motionEnabled = true; lastAcceleration = null;
    window.addEventListener('devicemotion', handleMotion);
    motionButton.setAttribute('aria-pressed', 'true');
    announce('Device motion on. Move your device gently.');
  } catch {
    announce('Couldn’t enable motion. Touch controls are ready.');
  } finally {
    motionPending = false; motionButton.disabled = false;
  }
});

if (!ctx) {
  announce('Canvas is unavailable in this browser.');
  for (const button of document.querySelectorAll('.controls button')) button.disabled = true;
} else {
  syncPauseButton(); resize(); syncLoop();
  if (paused) announce('Reduced motion is enabled. Resume when you’re ready.');
}
