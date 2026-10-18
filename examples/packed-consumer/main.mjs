import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createTrembita } from 'trembita';

const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/empty') {
    response.writeHead(204).end();
  } else if (path === '/unavailable') {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('upstream unavailable');
  } else if (path === '/html') {
    response.writeHead(502, { 'Content-Type': 'text/html' });
    response.end('<h1>Bad Gateway</h1>');
  } else if (path === '/malformed') {
    response.writeHead(200, { 'Content-Type': 'application/problem+json' });
    response.end('{');
  } else {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ name: 'Trembita' }));
  }
});

try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const created = createTrembita({
    endpoint: `http://127.0.0.1:${address.port}`,
    timeoutMs: 2_000
  });
  assert.equal(created.ok, true);
  const api = created.value;

  assert.deepEqual(await api.request({ path: '/json' }), {
    ok: true,
    value: { name: 'Trembita' }
  });
  assert.deepEqual(
    await api.request({ path: '/empty', expectedCodes: [204] }),
    { ok: true, value: undefined }
  );
  for (const [path, statusCode, body] of [
    ['/unavailable', 503, 'upstream unavailable'],
    ['/html', 502, '<h1>Bad Gateway</h1>']
  ]) {
    const result = await api.request({ path });
    assert.equal(result.ok, false);
    assert.equal(result.error.kind, 'unexpected_status');
    assert.equal(result.error.statusCode, statusCode);
    assert.equal(result.error.body, body);
  }
  const malformed = await api.request({ path: '/malformed' });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error.kind, 'invalid_json');
  console.log('consumer: JSON, 204, text/HTML errors, malformed JSON OK');
} finally {
  server.closeAllConnections();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
