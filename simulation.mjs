export const config = Object.freeze({
  particleCount: 400, connectRadius: 80, interactionRadius: 120,
  cameraZ: 400, holdMs: 500, dragThreshold: 8, reconnectMs: 1500,
  maxDeltaMs: 50, referenceFrameMs: 1000 / 60, maxRipple: 65,
});
export const palette = [[246, 48, 73], [208, 39, 82], [138, 36, 75]];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const trailAlpha = dt => 1 - Math.pow(0.8, dt / config.referenceFrameMs);

export class Garden {
  constructor(random = Math.random) {
    this.particles = Array.from({ length: config.particleCount }, () => ({
      n: Math.floor(random() * 3) + 1, a: random() * 5 + 2,
      baseRadius: random() * 200 + 50, omega: random() * 0.01 - 0.005,
      initialTheta: random() * Math.PI * 2, speed: random() * 0.002 + 0.001,
      color: palette[Math.floor(random() * palette.length)],
    }));
    this.resize(800, 600);
    this.reset();
  }
  resize(width, height) {
    this.width = width; this.height = height;
    // Reserve space for the title and controls on short or narrow screens.
    this.fit = Math.min(1, Math.max(0.1, (Math.min(width - 40, height - 242)) / 620));
    this.project();
  }
  reset() {
    this.time = 0;
    for (const p of this.particles) {
      p.theta = p.initialTheta; p.rippleX = 0; p.rippleY = 0; p.reconnectTimer = 0;
    }
    this.project();
  }
  update(elapsed) {
    const dt = clamp(elapsed, 0, config.maxDeltaMs);
    this.time += dt;
    const decay = Math.pow(0.98, dt / config.referenceFrameMs);
    for (const p of this.particles) {
      p.theta += p.speed * dt / config.referenceFrameMs;
      p.rippleX *= decay; p.rippleY *= decay;
      p.reconnectTimer = Math.max(0, p.reconnectTimer - dt);
    }
    this.project();
    return dt;
  }
  project() {
    for (const p of this.particles) {
      const theta = p.theta ?? p.initialTheta;
      const radius = p.baseRadius + p.a * Math.cos(p.n * theta + p.omega * (this.time ?? 0));
      const z = Math.sin(theta * 0.7) * radius * 0.3;
      p.scale = config.cameraZ / (config.cameraZ - z);
      p.screenX = Math.cos(theta) * radius * p.scale * this.fit + (p.rippleX || 0) + this.width / 2;
      p.screenY = Math.sin(theta) * radius * p.scale * this.fit + (p.rippleY || 0) + (this.height - 58) / 2;
    }
  }
  addForce(p, dx, dy) {
    p.rippleX += dx; p.rippleY += dy;
    const length = Math.hypot(p.rippleX, p.rippleY);
    const limit = Math.min(config.maxRipple, Math.min(this.width, this.height) * 0.12);
    if (length > limit) { p.rippleX *= limit / length; p.rippleY *= limit / length; }
  }
  interact(kind, x, y, dx = 0, dy = 0) {
    for (const p of this.particles) {
      const offsetX = p.screenX - x, offsetY = p.screenY - y;
      const distance = Math.hypot(offsetX, offsetY);
      if (distance >= config.interactionRadius) continue;
      const falloff = Math.pow(1 - distance / config.interactionRadius, 2);
      if (kind === 'hold') p.reconnectTimer = config.reconnectMs;
      else if (kind === 'drag') this.addForce(p, dx * 0.8 * falloff, dy * 0.8 * falloff);
      else {
        const angle = distance > 0 ? Math.atan2(offsetY, offsetX) : p.theta;
        this.addForce(p, Math.cos(angle) * 42 * falloff, Math.sin(angle) * 42 * falloff);
      }
    }
    this.project();
  }
  motion(dx, dy) {
    for (const p of this.particles) this.addForce(p, clamp(dx, -3, 3) * 5, clamp(dy, -3, 3) * 5);
    this.project();
  }
}

// Every eligible pair is visited once, including pairs across cell boundaries.
export function visitConnections(particles, radius, visit) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of particles) {
    const x = Math.floor(p.screenX / radius), y = Math.floor(p.screenY / radius);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (!particles.length) return 0;
  // Padding makes the eight neighboring numeric indexes safe at every edge.
  const stride = maxX - minX + 3;
  const cells = new Array(stride * (maxY - minY + 3));
  let checks = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.reconnectTimer > 0) continue;
    const cx = Math.floor(p.screenX / radius) - minX + 1;
    const cy = Math.floor(p.screenY / radius) - minY + 1;
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      const bucket = cells[x + y * stride];
      if (!bucket) continue;
      for (const j of bucket) {
        const other = particles[j];
        const dx = p.screenX - other.screenX, dy = p.screenY - other.screenY;
        const squared = dx * dx + dy * dy;
        checks++;
        if (squared < radius * radius) visit(other, p, Math.sqrt(squared), j, i);
      }
    }
    const key = cx + cy * stride;
    if (!cells[key]) cells[key] = [];
    cells[key].push(i);
  }
  return checks;
}

export class Gesture {
  constructor() { this.cancel(); }
  start(id, x, y, time) {
    if (this.active) return false;
    this.active = { id, x, y, startX: x, startY: y, time, dragged: false, held: false };
    return true;
  }
  move(id, x, y) {
    const p = this.active;
    if (!p || p.id !== id) return null;
    if (Math.hypot(x - p.startX, y - p.startY) >= config.dragThreshold) p.dragged = true;
    const result = p.dragged ? { kind: 'drag', x, y, dx: x - p.x, dy: y - p.y } : null;
    p.x = x; p.y = y;
    return result;
  }
  hold(time) {
    const p = this.active;
    if (!p || p.dragged || p.held || time - p.time < config.holdMs) return null;
    p.held = true;
    return { kind: 'hold', x: p.x, y: p.y };
  }
  end(id, time) {
    const p = this.active;
    if (!p || p.id !== id) return null;
    const result = this.hold(time) || (!p.dragged && !p.held ? { kind: 'tap', x: p.x, y: p.y } : null);
    this.cancel();
    return result;
  }
  cancel() { this.active = null; }
}
