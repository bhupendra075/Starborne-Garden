import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { Garden, Gesture, config, clamp, trailAlpha, visitConnections } from '../simulation.mjs';

const source = (await readFile(new URL('../app.mjs', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/, '');
function harness({ reduced = false, permission, secure = true, canvasSupported = true } = {}) {
  const makeTarget = () => ({
    listeners: new Map(), attributes: new Map(), disabled: false, textContent: '',
    addEventListener(type, handler) { this.listeners.set(type, handler); },
    removeEventListener(type, handler) { if (this.listeners.get(type) === handler) this.listeners.delete(type); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    fire(type, event = {}) { return this.listeners.get(type)?.(event); },
    focus() {},
  });
  const targets = Object.fromEntries(['garden', 'pause', 'motion', 'status', 'reset', 'dismiss', 'hint'].map(id => [id, makeTarget()]));
  const calls = [];
  const ctx = { fillRect() { calls.push('draw'); }, setTransform(...args) { calls.push(args); }, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {} };
  const captures = new Set();
  Object.assign(targets.garden, {
    getContext: () => canvasSupported ? ctx : null,
    getBoundingClientRect: () => ({ width: 320, height: 568, left: 0, top: 0 }),
    hasPointerCapture: id => captures.has(id),
    setPointerCapture: id => captures.add(id),
    releasePointerCapture: id => captures.delete(id),
  });
  const document = Object.assign(makeTarget(), {
    hidden: false, querySelector: selector => targets[selector.slice(1)],
    querySelectorAll: () => [targets.pause, targets.reset, targets.motion],
  });
  const window = Object.assign(makeTarget(), { isSecureContext: secure, devicePixelRatio: 3 });
  const media = Object.assign(makeTarget(), { matches: reduced });
  let time = 0, serial = 0;
  const frames = new Map(), timers = new Map();
  const scope = {
    Garden, Gesture, config, clamp, trailAlpha, visitConnections, document, window,
    matchMedia: () => media, performance: { now: () => time },
    requestAnimationFrame: fn => { const id = ++serial; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: fn => { const id = ++serial; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
  };
  if (permission !== undefined) scope.DeviceMotionEvent = { requestPermission: permission };
  runInNewContext(source, scope);
  return {
    targets, document, window, media, frames, timers, calls, captures,
    tick(timestamp) { time = timestamp; const callbacks = [...frames.values()]; frames.clear(); for (const fn of callbacks) fn(timestamp); },
  };
}

test('reduced motion starts paused; resume, pause, reset, and hidden tabs manage one animation loop', () => {
  const app = harness({ reduced: true });
  const { targets, frames, document } = app;
  assert.equal(frames.size, 0);
  assert.equal(targets.pause.textContent, 'Resume');
  assert.equal(targets.garden.width, 640);
  targets.pause.fire('click');
  assert.equal(frames.size, 1);
  app.tick(100); app.tick(116);
  assert.equal(frames.size, 1);
  document.hidden = true; document.fire('visibilitychange');
  assert.equal(frames.size, 0);
  document.hidden = false; document.fire('visibilitychange');
  assert.equal(frames.size, 1);
  const draws = app.calls.filter(x => x === 'draw').length;
  app.tick(999999);
  assert.equal(app.calls.filter(x => x === 'draw').length, draws);
  targets.pause.fire('click'); targets.reset.fire('click');
  assert.equal(frames.size, 0);
  assert.equal(targets.pause.textContent, 'Resume');
  assert.equal(targets.status.textContent, 'Garden restored.');
});
test('pointer capture and pending holds are released on cancellation, pause, and secondary touch', () => {
  const app = harness();
  const point = id => ({ pointerId: id, button: 0, isPrimary: id === 1, clientX: 100, clientY: 150 });
  app.targets.garden.fire('pointerdown', point(1));
  assert.equal(app.captures.has(1), true); assert.equal(app.timers.size, 1);
  app.targets.garden.fire('pointercancel', point(1));
  assert.equal(app.captures.size, 0); assert.equal(app.timers.size, 0);
  app.targets.garden.fire('pointerdown', point(1));
  app.targets.garden.fire('pointerdown', point(2));
  assert.equal(app.captures.size, 0); assert.equal(app.timers.size, 0);
  app.targets.garden.fire('pointerdown', point(1));
  app.targets.pause.fire('click');
  assert.equal(app.captures.size, 0); assert.equal(app.timers.size, 0);
});
test('motion permission grant attaches one listener and switching off removes it', async () => {
  let requests = 0;
  const app = harness({ permission: async () => { requests++; return 'granted'; } });
  assert.equal(requests, 0);
  await app.targets.motion.fire('click');
  assert.equal(requests, 1);
  assert.equal(app.targets.motion.attributes.get('aria-pressed'), 'true');
  assert.equal(app.window.listeners.has('devicemotion'), true);
  app.window.fire('devicemotion', { acceleration: null });
  app.window.fire('devicemotion', { acceleration: { x: 1, y: 2 } });
  app.window.fire('devicemotion', { acceleration: { x: 3, y: 4 } });
  await app.targets.motion.fire('click');
  assert.equal(app.window.listeners.has('devicemotion'), false);
  assert.equal(app.targets.motion.attributes.get('aria-pressed'), 'false');
});
test('motion denial and failures leave controls and rendering available', async () => {
  for (const permission of [async () => 'denied', async () => { throw new Error('Denied'); }]) {
    const app = harness({ permission });
    await app.targets.motion.fire('click');
    assert.equal(app.window.listeners.has('devicemotion'), false);
    assert.equal(app.targets.motion.disabled, false);
    assert.equal(app.frames.size, 1);
    assert.match(app.targets.status.textContent, /Touch controls are ready/);
  }
});
test('unsupported sensors and insecure origins explain the fallback without blocking the garden', async () => {
  for (const options of [{}, { secure: false, permission: async () => 'granted' }]) {
    const app = harness(options);
    await app.targets.motion.fire('click');
    assert.match(app.targets.status.textContent, /Touch controls are ready/);
    assert.equal(app.frames.size, 1);
  }
});
test('live reduced-motion changes cancel animation and a missing canvas context fails gracefully', () => {
  const app = harness();
  app.media.fire('change', { matches: true });
  assert.equal(app.frames.size, 0);
  assert.equal(app.targets.pause.textContent, 'Resume');
  const unsupported = harness({ canvasSupported: false });
  assert.equal(unsupported.frames.size, 0);
  assert.equal(unsupported.targets.pause.disabled, true);
  assert.match(unsupported.targets.status.textContent, /Canvas is unavailable/);
  assert.doesNotThrow(() => unsupported.window.fire('resize'));
});
