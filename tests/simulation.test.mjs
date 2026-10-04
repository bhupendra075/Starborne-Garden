import test from 'node:test';
import assert from 'node:assert/strict';
import { Garden, Gesture, config, trailAlpha, visitConnections } from '../simulation.mjs';

const seeded = () => { let seed = 73421; return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} differs from ${b}`);
test('30, 60, and 120 Hz produce equivalent movement, decay, timers, and trail opacity', () => {
  const results = [30, 60, 120].map(hz => {
    const garden = new Garden(seeded());
    garden.particles[0].rippleX = 40;
    garden.particles[0].reconnectTimer = 1500;
    let remainingTrail = 1;
    for (let i = 0; i < hz; i++) {
      garden.update(1000 / hz); remainingTrail *= 1 - trailAlpha(1000 / hz);
    }
    return { garden, remainingTrail };
  });
  for (const result of results.slice(1)) {
    close(result.remainingTrail, results[0].remainingTrail);
    close(result.garden.time, 1000);
    for (let i = 0; i < 400; i++) {
      for (const key of ['theta', 'rippleX', 'screenX', 'screenY', 'reconnectTimer']) {
        close(result.garden.particles[i][key], results[0].garden.particles[i][key]);
      }
    }
  }
});
test('long frame gaps are clamped and reset restores the original arrangement', () => {
  const garden = new Garden(seeded());
  const before = structuredClone(garden.particles);
  assert.equal(garden.update(60000), config.maxDeltaMs);
  garden.motion(1000, -1000); garden.reset();
  assert.deepEqual(garden.particles, before);
});
test('spatial grid matches exhaustive checks at boundaries and negative coordinates without duplicates', () => {
  const garden = new Garden(seeded());
  const particles = [...garden.particles, ...[-80, -0.001, 0, 79.999, 80, 160].map(x => ({ screenX: x, screenY: 0, reconnectTimer: 0 }))];
  particles[0].reconnectTimer = 100;
  const expected = [], actual = [];
  for (let i = 0; i < particles.length; i++) for (let j = i + 1; j < particles.length; j++) {
    const a = particles[i], b = particles[j];
    if (a.reconnectTimer > 0 || b.reconnectTimer > 0) continue;
    if ((a.screenX - b.screenX) ** 2 + (a.screenY - b.screenY) ** 2 < 80 ** 2) expected.push(`${i}:${j}`);
  }
  visitConnections(particles, 80, (a, b, distance, i, j) => actual.push(`${i}:${j}`));
  assert.equal(new Set(actual).size, actual.length);
  assert.deepEqual(actual.sort(), expected.sort());
});
test('tap, drag, and hold affect only nearby particles, with bounded motion', () => {
  const garden = new Garden(seeded());
  garden.particles = [
    { screenX: 10, screenY: 0, theta: 0, rippleX: 0, rippleY: 0, reconnectTimer: 0 },
    { screenX: 121, screenY: 0, theta: 0, rippleX: 0, rippleY: 0, reconnectTimer: 0 },
  ];
  garden.project = () => {};
  garden.interact('tap', 0, 0);
  assert.ok(garden.particles[0].rippleX > 0);
  assert.equal(garden.particles[1].rippleX, 0);
  garden.interact('hold', 0, 0);
  assert.equal(garden.particles[0].reconnectTimer, 1500);
  assert.equal(garden.particles[1].reconnectTimer, 0);
  garden.interact('drag', 0, 0, 0, 10);
  assert.ok(garden.particles[0].rippleY > 0);
  assert.equal(garden.particles[1].rippleY, 0);
  for (let i = 0; i < 1000; i++) garden.motion(999, 999);
  for (const p of garden.particles) assert.ok(Math.hypot(p.rippleX, p.rippleY) <= config.maxRipple + 1e-9);
});
test('garden fits narrow and landscape screens', () => {
  const garden = new Garden(seeded());
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1280, 800]]) {
    garden.resize(width, height);
    for (const p of garden.particles) {
      assert.ok(p.screenX > 0 && p.screenX < width);
      assert.ok(p.screenY > 50 && p.screenY < height - 80);
    }
  }
});
test('tap and hold are exclusive; drag never fires a tap on release', () => {
  const gesture = new Gesture();
  gesture.start(1, 10, 10, 0);
  assert.equal(gesture.end(1, 100).kind, 'tap');
  gesture.start(1, 10, 10, 0);
  assert.equal(gesture.hold(499), null);
  assert.equal(gesture.hold(500).kind, 'hold');
  assert.equal(gesture.hold(600), null);
  assert.equal(gesture.end(1, 700), null);
  gesture.start(1, 10, 10, 0);
  assert.equal(gesture.move(1, 18, 10).kind, 'drag');
  assert.equal(gesture.hold(1000), null);
  assert.equal(gesture.end(1, 1100), null);
});
test('secondary pointers are ignored and canceled gestures have no release effect', () => {
  const gesture = new Gesture();
  assert.equal(gesture.start(1, 0, 0, 0), true);
  assert.equal(gesture.start(2, 10, 10, 0), false);
  assert.equal(gesture.move(2, 50, 50), null);
  assert.equal(gesture.end(2, 100), null);
  assert.equal(gesture.active.id, 1);
  gesture.cancel();
  assert.equal(gesture.end(1, 100), null);
  assert.equal(gesture.hold(1000), null);
});
