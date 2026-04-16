import { createTrembita, HTTP_OK } from 'trembita';
import {
  expandOpenapiPath,
  requestOpenapiPath,
  validateStandardSchema
} from '@trembita/openapi';

const fetchImpl = () =>
  Promise.resolve(
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  );

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

console.log('dogfood: ok');
