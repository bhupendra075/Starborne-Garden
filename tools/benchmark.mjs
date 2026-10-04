import { Garden, config, visitConnections } from '../simulation.mjs';
let seed = 73421;
const garden = new Garden(() => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646);
garden.resize(1280, 800);
const radius = config.connectRadius * garden.fit;
function exhaustive() {
  let checks = 0, connections = 0;
  for (let i = 0; i < garden.particles.length; i++) for (let j = i + 1; j < garden.particles.length; j++) {
    const a = garden.particles[i], b = garden.particles[j];
    checks++;
    if ((a.screenX - b.screenX) ** 2 + (a.screenY - b.screenY) ** 2 < radius ** 2) connections++;
  }
  return { checks, connections };
}
function grid() {
  let connections = 0;
  const checks = visitConnections(garden.particles, radius, () => connections++);
  return { checks, connections };
}
function measure(run) {
  for (let i = 0; i < 100; i++) run();
  const times = [];
  for (let round = 0; round < 7; round++) {
    const start = performance.now();
    for (let i = 0; i < 200; i++) run();
    times.push((performance.now() - start) / 200);
  }
  return { ...run(), medianMs: Number(times.sort((a, b) => a - b)[3].toFixed(3)) };
}
console.log(JSON.stringify({ particles: 400, exhaustive: measure(exhaustive), grid: measure(grid), note: 'Node connection-search benchmark; excludes canvas drawing and is not a browser FPS measurement.' }, null, 2));
