import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { gzipSync } from 'node:zlib';
import postcss from 'postcss';

test('updated Express parser/router preserve JSON routes and reject oversized or corrupt compressed bodies', async () => {
  const app = express();
  app.use(express.json({ limit: '1kb' }));
  app.post('/api/workouts/:id', (req, res) => res.json({ id: req.params.id, body: req.body }));
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.sendStatus(error.status ?? 500); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/workouts/run-123`;
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test workout' }) });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { id: 'run-123', body: { name: 'Test workout' } });
    const oversized = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x'.repeat(2000) }) });
    assert.equal(oversized.status, 413);
    const corrupt = Buffer.concat([gzipSync('{"name":"test"}'), Buffer.from([1, 2, 3])]);
    const compressed = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }, body: corrupt });
    assert.equal(compressed.status, 400);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
test('reviewed PostCSS minor override preserves CSS parse/transform behavior used by tooling', async () => {
  const result = await postcss([{
    postcssPlugin: 'test-preserve-transform', Declaration(decl) { if (decl.prop === 'color') decl.value = '#ff8c00'; },
  }]).process('.run { color: orange; padding: 2px; }', { from: undefined, map: false });
  assert.match(result.css, /color: #ff8c00/); assert.match(result.css, /padding: 2px/);
});
