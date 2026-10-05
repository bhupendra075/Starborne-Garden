import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function bounded(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timed out')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

test('unsupported methods return 405 with Allow', { timeout: 10000 }, async (t) => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await bounded(once(reservation, 'listening'), 2000);
  const { port } = reservation.address();
  await bounded(new Promise((resolve) => reservation.close(resolve)), 2000);
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('../tools/serve.mjs', import.meta.url)),
  ], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill();
    await bounded(exited, 2000);
  });

  await bounded(new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.includes(`Starborne Garden: http://127.0.0.1:${port}`)) resolve();
    });
    child.once('error', reject);
    child.once('exit', () => reject(new Error('Server exited before startup')));
  }), 3000);

  const response = await bounded(new Promise((resolve, reject) => {
    const req = request({
      hostname: '127.0.0.1',
      port, path: '/', method: 'POST',
    }, (res) => {
      res.resume();
      res.once('end', () => resolve(res));
      res.once('error', reject);
    });
    req.once('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('Request timed out')));
    req.end();
  }), 3000);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, 'GET, HEAD');
});
