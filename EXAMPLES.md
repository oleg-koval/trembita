# Trembita Examples

Practical, copy-paste-ready examples for common HTTP client scenarios.

## Table of Contents

- [GitHub API Client](#github-api-client)
- [Payment Provider (Stripe-like)](#payment-provider-stripe-like)
- [Microservice Communication](#microservice-communication)
- [Health Check Monitoring](#health-check-monitoring)
- [Webhook Receiver with Retries](#webhook-receiver-with-retries)
- [Search Service Client](#search-service-client)
- [Database Backup Service](#database-backup-service)

---

## GitHub API Client

Fetch repositories and manage issues.

```typescript
import { createTrembita, HTTP_OK, HTTP_CREATED } from 'trembita';

const github = createTrembita({
  endpoint: 'https://api.github.com'
});

if (!github.ok) throw new Error('Invalid GitHub config');

const client = github.value;

// List user repositories
async function listUserRepos(username: string) {
  const result = await client.request({
    path: `/users/${username}/repos`,
    query: { per_page: '10', sort: 'updated' },
    expectedCodes: [HTTP_OK]
  });

  if (!result.ok) {
    if (
      result.error.kind === 'unexpected_status' &&
      result.error.statusCode === 404
    ) {
      return { repos: [], error: 'User not found' };
    }
    return { repos: [], error: result.error.kind };
  }

  return { repos: result.value, error: null };
}

// Create an issue
async function createIssue(repo: string, title: string, body: string) {
  const result = await client.request({
    path: `/repos/${repo}/issues`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json'
    },
    body: { title, body, labels: ['bug'] },
    expectedCodes: [HTTP_CREATED]
  });

  if (result.ok) {
    return { issue: result.value, error: null };
  }

  if (
    result.error.kind === 'unexpected_status' &&
    result.error.statusCode === 422
  ) {
    return { issue: null, error: 'Validation failed' };
  }

  return { issue: null, error: result.error.kind };
}

// Usage
const repos = await listUserRepos('torvalds');
console.log(`Repos:`, repos);

const issue = await createIssue(
  'torvalds/linux',
  'Bug report',
  'Description here'
);
console.log(`Created:`, issue);
```

---

## Payment Provider (Stripe-like)

Handle payments with retry logic and clear error messages.

```typescript
import { createTrembita, HTTP_OK, createRetryingFetch } from 'trembita';

// Retry on transient failures (5xx, timeouts)
const retryingFetch = createRetryingFetch({
  initialDelayMs: 100,
  maxAttempts: 3,
  shouldRetry: (statusCode) => statusCode >= 500
});

const stripe = createTrembita({
  endpoint: 'https://api.stripe.com/v1',
  fetchImpl: retryingFetch,
  timeoutMs: 10_000,
  log: {
    error: (msg, meta) => console.error(`[Stripe Error] ${msg}`, meta),
    info: (msg, meta) => console.log(`[Stripe] ${msg}`, meta)
  }
});

if (!stripe.ok) throw new Error('Stripe init failed');

const client = stripe.value;

interface CreateChargePayload {
  amount: number;
  currency: string;
  source: string;
  description?: string;
}

async function createCharge(payload: CreateChargePayload) {
  const result = await client.request({
    path: '/charges',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`
    },
    body: payload,
    expectedCodes: [HTTP_OK]
  });

  if (result.ok) {
    return { charge: result.value, error: null };
  }

  // Handle specific error cases
  const { error } = result;
  if (error.kind === 'unexpected_status') {
    if (error.statusCode === 402) {
      return { charge: null, error: 'Card declined' };
    }
    if (error.statusCode === 401) {
      return { charge: null, error: 'Invalid API key' };
    }
  }

  if (error.kind === 'timeout') {
    return {
      charge: null,
      error: 'Request timeout; transaction may still be pending'
    };
  }

  if (error.kind === 'fetch_failed') {
    return { charge: null, error: 'Network error; please retry' };
  }

  return { charge: null, error: `Payment failed: ${error.kind}` };
}

// Usage
const charge = await createCharge({
  amount: 2000, // $20.00
  currency: 'usd',
  source: 'tok_visa',
  description: 'Order #12345'
});

if (charge.error) {
  console.error('Charge failed:', charge.error);
} else {
  console.log('Charge ID:', charge.charge.id);
}
```

---

## Microservice Communication

Internal service-to-service HTTP calls with circuit breaker.

```typescript
import { createTrembita, HTTP_OK } from 'trembita';

// Prevent cascading failures when service is down
const userService = createTrembita({
  endpoint: 'http://user-service.internal:3000',
  circuitBreaker: {
    failureThreshold: 5, // open after 5 consecutive failures
    cooldownMs: 30_000 // retry after 30 seconds
  },
  timeoutMs: 5_000 // 5 second timeout
});

if (!userService.ok) throw new Error('User service config invalid');

const client = userService.value;

interface User {
  id: string;
  email: string;
  createdAt: string;
}

async function getUser(userId: string): Promise<User | null> {
  const result = await client.client({
    path: `/users/${userId}`,
    expectedCodes: [HTTP_OK, 404]
  });

  if (!result.ok) {
    if (result.error.kind === 'circuit_open') {
      // Service is temporarily down, use fallback
      console.warn('User service circuit open, using fallback');
      return null;
    }

    if (result.error.kind === 'timeout') {
      console.error('User service timeout');
      return null;
    }

    console.error('User service error:', result.error.kind);
    return null;
  }

  const { statusCode, body } = result.value;
  if (statusCode === 404) {
    return null; // User not found
  }

  return body as User;
}

// Batch fetch with error recovery
async function getUsersBatch(userIds: string[]) {
  const results = await Promise.allSettled(userIds.map((id) => getUser(id)));

  const users = results
    .filter(
      (r): r is PromiseFulfilledResult<User | null> =>
        r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value);

  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`Fetched ${users.length} users, ${failed} failed`);
  return users;
}

// Usage
const user = await getUser('user-123');
const batchUsers = await getUsersBatch(['user-1', 'user-2', 'user-3']);
```

---

## Health Check Monitoring

Monitor multiple service endpoints.

```typescript
import { createTrembita } from 'trembita';

interface HealthStatus {
  name: string;
  healthy: boolean;
  statusCode?: number;
  latencyMs: number;
  error?: string;
}

async function checkHealth(
  name: string,
  endpoint: string
): Promise<HealthStatus> {
  const start = performance.now();

  const api = createTrembita({
    endpoint,
    timeoutMs: 3_000 // 3 second timeout for health checks
  });

  if (!api.ok) {
    return {
      name,
      healthy: false,
      latencyMs: performance.now() - start,
      error: `Init failed: ${api.error.kind}`
    };
  }

  const result = await api.value.client({ path: '/health' });
  const latencyMs = performance.now() - start;

  if (!result.ok) {
    return {
      name,
      healthy: false,
      latencyMs,
      error: result.error.kind
    };
  }

  const { statusCode } = result.value;
  const healthy = statusCode >= 200 && statusCode < 300;

  return {
    name,
    healthy,
    statusCode,
    latencyMs
  };
}

// Monitor dashboard
async function healthDashboard(
  services: Array<{ name: string; endpoint: string }>
) {
  const statuses = await Promise.all(
    services.map(({ name, endpoint }) => checkHealth(name, endpoint))
  );

  const allHealthy = statuses.every((s) => s.healthy);
  const avgLatency =
    statuses.reduce((sum, s) => sum + s.latencyMs, 0) / statuses.length;

  console.log(`Overall: ${allHealthy ? '✓ Healthy' : '✗ Degraded'}`);
  console.log(`Avg latency: ${avgLatency.toFixed(0)}ms`);
  console.log('---');

  statuses.forEach((status) => {
    const indicator = status.healthy ? '✓' : '✗';
    console.log(
      `${indicator} ${status.name} (${status.statusCode || '?'}): ${status.latencyMs.toFixed(0)}ms`
    );

    if (status.error) {
      console.log(`  Error: ${status.error}`);
    }
  });

  return statuses;
}

// Usage
const services = [
  { name: 'API', endpoint: 'https://api.example.com' },
  { name: 'Auth', endpoint: 'https://auth.example.com' },
  { name: 'Search', endpoint: 'https://search.example.com' }
];

await healthDashboard(services);
```

---

## Webhook Receiver with Retries

Call downstream webhooks with exponential backoff.

```typescript
import { createTrembita, createRetryingFetch } from 'trembita';

const retryingFetch = createRetryingFetch({
  initialDelayMs: 1000,
  maxAttempts: 5,
  // Retry on transient errors or 5xx status codes
  shouldRetry: (statusCode) => statusCode >= 500
});

interface WebhookPayload {
  event: string;
  timestamp: number;
  data: Record<string, unknown>;
}

async function deliverWebhook(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<boolean> {
  const url = new URL(webhookUrl);
  const api = createTrembita({
    endpoint: url.origin,
    fetchImpl: retryingFetch,
    timeoutMs: 10_000
  });

  if (!api.ok) {
    console.error(`Bad webhook URL: ${webhookUrl}`);
    return false;
  }

  const path = `${url.pathname}${url.search}` || '/';

  const result = await api.value.request({
    path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': generateSignature(payload)
    },
    body: payload,
    expectedCodes: [200, 201, 204] // Accept any success code
  });

  if (result.ok) {
    console.log(`Webhook delivered: ${webhookUrl}`);
    return true;
  }

  if (result.error.kind === 'unexpected_status') {
    console.error(
      `Webhook rejected (${result.error.statusCode}): ${webhookUrl}`
    );
    return false; // Don't retry 4xx
  }

  console.error(
    `Webhook delivery failed (${result.error.kind}): ${webhookUrl}`
  );
  return false; // Retries already handled by createRetryingFetch
}

// Queue manager for batch deliveries
async function deliverWebhooks(
  webhookUrls: string[],
  payload: WebhookPayload
): Promise<{ succeeded: string[]; failed: string[] }> {
  const results = await Promise.allSettled(
    webhookUrls.map((url) => deliverWebhook(url, payload))
  );

  const succeeded = webhookUrls.filter(
    (_, i) => results[i].status === 'fulfilled' && results[i].value === true
  );
  const failed = webhookUrls.filter(
    (_, i) => !succeeded.includes(webhookUrls[i])
  );

  console.log(`Delivered to ${succeeded.length}/${webhookUrls.length}`);
  return { succeeded, failed };
}

function generateSignature(payload: WebhookPayload): string {
  // HMAC signature for security; omitted here
  return 'sig_placeholder';
}

// Usage
const webhooks = [
  'https://hook1.example.com/api/events',
  'https://hook2.example.com/api/events'
];
const payload: WebhookPayload = {
  event: 'order.created',
  timestamp: Date.now(),
  data: { orderId: '12345', total: 99.99 }
};

const delivery = await deliverWebhooks(webhooks, payload);
console.log('Succeeded:', delivery.succeeded);
```

---

## Search Service Client

Query a search service with pagination and filters.

```typescript
import { createTrembita, HTTP_OK } from 'trembita';

interface SearchQuery {
  q: string;
  page?: number;
  limit?: number;
  filters?: Record<string, string>;
}

interface SearchResult {
  id: string;
  title: string;
  score: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  hasMore: boolean;
}

const searchApi = createTrembita({
  endpoint: 'https://search.example.com',
  timeoutMs: 5_000
});

if (!searchApi.ok) throw new Error('Search service config invalid');

const client = searchApi.value;

async function searchDocuments(
  query: SearchQuery
): Promise<SearchResponse | null> {
  const queryParams: Record<string, string> = {
    q: query.q,
    page: String(query.page || 1),
    limit: String(query.limit || 20),
    ...Object.fromEntries(
      Object.entries(query.filters || {}).map(([k, v]) => [`filter_${k}`, v])
    )
  };

  const result = await client.client({
    path: '/search',
    query: queryParams
  });

  if (!result.ok) {
    if (result.error.kind === 'timeout') {
      console.error('Search timeout; try with fewer filters');
    } else if (result.error.kind === 'fetch_failed') {
      console.error('Search service unreachable');
    } else {
      console.error('Search failed:', result.error.kind);
    }

    return null;
  }

  const { statusCode, body } = result.value;

  if (statusCode === 400) {
    console.error('Invalid search query');
    return null;
  }

  return body as SearchResponse;
}

// Convenience function for simple searches
async function searchArticles(q: string) {
  return searchDocuments({
    q,
    limit: 10,
    filters: { type: 'article' }
  });
}

// Pagination helper
async function* searchPages(q: string, pageSize = 20) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const result = await searchDocuments({
      q,
      page,
      limit: pageSize
    });

    if (!result) break;

    yield result.results;

    hasMore = result.hasMore;
    page++;
  }
}

// Usage
const results = await searchArticles('typescript http client');
console.log(`Found ${results?.total || 0} results`);

// Stream large result sets
for await (const batch of searchPages('trembita')) {
  console.log(`Processing ${batch.length} results...`);
  // Process each page
}
```

---

## Database Backup Service

Trigger and monitor a backup job.

```typescript
import { createTrembita, HTTP_OK, HTTP_CREATED } from 'trembita';

const HTTP_ACCEPTED = 202;

interface BackupJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
  completedAt?: string;
  size?: number;
}

const backupApi = createTrembita({
  endpoint: 'https://backup.example.com/api/v1',
  timeoutMs: 60_000, // Longer timeout for backup operations
  log: {
    info: (msg, meta) => console.log(`[Backup] ${msg}`, meta)
  }
});

if (!backupApi.ok) throw new Error('Backup service unavailable');

const client = backupApi.value;

async function startBackup(): Promise<string | null> {
  const result = await client.request({
    path: '/backups',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.BACKUP_API_KEY}`
    },
    body: {
      type: 'full',
      retention_days: 30
    },
    expectedCodes: [HTTP_CREATED, HTTP_ACCEPTED]
  });

  if (!result.ok) {
    console.error('Backup start failed:', result.error.kind);
    return null;
  }

  const jobId = (result.value as { id: string }).id;
  console.log(`Backup started: ${jobId}`);
  return jobId;
}

async function getBackupStatus(jobId: string): Promise<BackupJob | null> {
  const result = await client.client({
    path: `/backups/${jobId}`,
    expectedCodes: [HTTP_OK, 404]
  });

  if (!result.ok) {
    console.error('Status check failed:', result.error.kind);
    return null;
  }

  const { statusCode, body } = result.value;

  if (statusCode === 404) {
    console.error(`Backup job not found: ${jobId}`);
    return null;
  }

  return body as BackupJob;
}

// Monitor a backup until completion
async function waitForBackup(
  jobId: string,
  pollIntervalMs = 5000,
  maxWaitMs = 3600000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const job = await getBackupStatus(jobId);

    if (!job) {
      return false;
    }

    console.log(`Job ${jobId}: ${job.status} (${job.progress}%)`);

    if (job.status === 'completed') {
      console.log(
        `Backup complete! Size: ${(job.size! / 1024 / 1024).toFixed(2)} MB`
      );
      return true;
    }

    if (job.status === 'failed') {
      console.error(`Backup failed: ${jobId}`);
      return false;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  console.error(`Backup timeout: ${jobId}`);
  return false;
}

// Usage
const jobId = await startBackup();
if (jobId) {
  const success = await waitForBackup(jobId);
  console.log(`Backup result: ${success ? 'success' : 'failed'}`);
}
```

---

## Tips

- **Type your responses**: Use TypeScript interfaces for JSON responses
- **Narrow errors safely**: Check `error.kind` for specific failure modes
- **Inject fetch for testing**: Pass `fetchImpl` in unit tests to avoid network
  calls
- **Compose helpers**: Don't repeat `request` calls; wrap common patterns
- **Handle both paths**: Always handle `!result.ok` to prevent runtime errors

See [LEARNING_GUIDE.md](./LEARNING_GUIDE.md) for deeper patterns and concepts.
