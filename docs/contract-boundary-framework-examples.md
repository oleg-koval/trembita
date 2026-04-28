# Contract Boundary Client Framework Examples

These examples show where the Trembita OpenAPI client belongs in backend apps:
create one boundary client per downstream service, then translate `Result`
failures at the framework edge.

## Fastify-style route

```ts
import type { FastifyInstance } from 'fastify';
import type { paths } from './generated/users.paths.js';
import { createOpenapiClient } from '@trembita/openapi';

const usersClient = createOpenapiClient<paths>({
  endpoint: 'https://users.internal',
  policies: {
    'GET /users/{userId}': { expectedStatus: 200, timeoutMs: 500 }
  },
  responseSchemas: {
    'GET /users/{userId} 200': userSchema
  }
});

if (!usersClient.ok) throw new Error('invalid users client');

export const registerRoutes = (app: FastifyInstance): void => {
  app.get('/profiles/:userId', async (request, reply) => {
    const userId = (request.params as { userId: string }).userId;
    const user = await usersClient.value.GET('/users/{userId}', {
      params: { userId }
    });

    if (!user.ok) {
      if (user.error.kind === 'unexpected_status')
        return reply.code(502).send(user.error);
      if (user.error.kind === 'invalid_response')
        return reply.code(502).send(user.error);
      if (user.error.kind === 'timeout')
        return reply.code(504).send(user.error);
      return reply.code(500).send(user.error);
    }

    return reply.send(user.value);
  });
};
```

## Hono / Workers-style route

```ts
import type { paths } from './generated/users.paths.js';
import { Hono } from 'hono';
import { createOpenapiClient } from '@trembita/openapi';

const app = new Hono();
const usersClient = createOpenapiClient<paths>({
  endpoint: 'https://users.internal',
  fetchImpl: fetch,
  policies: {
    'GET /users/{userId}': { expectedStatus: 200, timeoutMs: 500 }
  }
});

if (!usersClient.ok) throw new Error('invalid users client');

app.get('/profiles/:userId', async (c) => {
  const user = await usersClient.value.GET('/users/{userId}', {
    params: { userId: c.req.param('userId') }
  });

  if (!user.ok) {
    const status = user.error.kind === 'timeout' ? 504 : 502;
    return c.json({ error: user.error.kind }, status);
  }

  return c.json(user.value);
});
```

## NestJS-style service

```ts
import type { paths } from './generated/users.paths.js';
import { Injectable, BadGatewayException } from '@nestjs/common';
import { createOpenapiClient } from '@trembita/openapi';

@Injectable()
export class ProfilesService {
  private readonly users = createOpenapiClient<paths>({
    endpoint: 'https://users.internal',
    policies: {
      'GET /users/{userId}': { expectedStatus: 200, timeoutMs: 500 }
    }
  });

  async getProfile(userId: string) {
    if (!this.users.ok) throw new Error('invalid users client');

    const user = await this.users.value.GET('/users/{userId}', {
      params: { userId }
    });

    if (!user.ok) {
      throw new BadGatewayException({ downstreamError: user.error.kind });
    }

    return user.value;
  }
}
```
