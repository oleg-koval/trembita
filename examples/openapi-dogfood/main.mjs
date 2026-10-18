import { createTrembita, HTTP_OK } from 'trembita';
import {
  expandOpenapiPath,
  requestOpenapiPath,
  validateStandardSchema
} from '@trembita/openapi';

const fetchImpl = (input) => {
  const { pathname } = new URL(String(input));
  if (pathname.endsWith('/no-content')) {
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  if (pathname.endsWith('/unavailable')) {
    return Promise.resolve(
      new Response('upstream unavailable', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    );
  }
  return Promise.resolve(
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  );
};

const created = createTrembita({
  endpoint: 'https://api.example.com',
  fetchImpl
});
if (!created.ok) {
  console.error('dogfood: createTrembita failed', created.error);
  process.exit(1);
}

const expanded = expandOpenapiPath('/users/{userId}', { userId: '1' });
if (!expanded.ok) {
  console.error('dogfood: expandOpenapiPath failed', expanded.error);
  process.exit(1);
}

const schema = {
  '~standard': {
    version: 1,
    vendor: 'dogfood',
    validate: (v) => {
      if (v !== null && typeof v === 'object' && v.ok === true) {
        return { value: v };
      }
      return { issues: [{ message: 'expected { ok: true }' }] };
    }
  }
};
const validated = await validateStandardSchema({ ok: true }, schema);
if (!validated.ok) {
  console.error('dogfood: validateStandardSchema failed', validated.error);
  process.exit(1);
}

const req = await requestOpenapiPath(
  created.value,
  '/users/{userId}',
  { userId: '1' },
  { method: 'GET', expectedCodes: [HTTP_OK] }
);
if (!req.ok) {
  console.error('dogfood: requestOpenapiPath failed', req.error);
  process.exit(1);
}

const noContent = await created.value.request({
  path: '/no-content',
  expectedCodes: [204]
});
if (!noContent.ok || noContent.value !== undefined) {
  console.error('dogfood: 204 response was not treated as empty', noContent);
  process.exit(1);
}

const unavailable = await created.value.request({
  path: '/unavailable',
  expectedCodes: [HTTP_OK]
});
if (
  unavailable.ok ||
  unavailable.error.kind !== 'unexpected_status' ||
  unavailable.error.statusCode !== 503 ||
  unavailable.error.body !== 'upstream unavailable'
) {
  console.error('dogfood: text HTTP error was not preserved', unavailable);
  process.exit(1);
}

console.log('dogfood: ok');
