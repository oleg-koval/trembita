/**
 * REST API Client Starter Template
 *
 * A complete, typed REST client example for a hypothetical TODO API.
 * Copy this pattern for your own APIs.
 */

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  createTrembita,
  HTTP_OK,
  HTTP_CREATED,
  HTTP_NO_CONTENT,
  TrembitaRequestError
} from 'trembita';

// ============================================================================
// Domain Types
// ============================================================================

interface TodoItem {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

interface CreateTodoPayload {
  title: string;
}

interface UpdateTodoPayload {
  title?: string;
  completed?: boolean;
}

// Result type alias for clarity
type ApiResult<T> = Promise<{ data: T | null; error: string | null }>;

// ============================================================================
// Client Initialization
// ============================================================================

const api = createTrembita({
  endpoint: 'https://jsonplaceholder.typicode.com', // Example public API
  timeoutMs: 10_000,
  log: {
    debug: (msg, meta) => console.debug(`[API Debug] ${msg}`, meta),
    error: (msg, meta) => console.error(`[API Error] ${msg}`, meta)
  }
});

if (!api.ok) {
  throw new Error(`Failed to initialize API client: ${api.error.kind}`);
}

const client = api.value;

// ============================================================================
// API Methods
// ============================================================================

async function listTodos(): ApiResult<TodoItem[]> {
  const result = await client.request({
    path: '/todos',
    expectedCodes: [HTTP_OK]
  });

  if (!result.ok) {
    return { data: null, error: `Failed to fetch todos: ${result.error.kind}` };
  }

  return { data: result.value, error: null };
}

async function getTodo(id: number): ApiResult<TodoItem> {
  const result = await client.client({
    path: `/todos/${id}`,
    expectedCodes: [HTTP_OK, 404]
  });

  if (!result.ok) {
    return { data: null, error: `Failed to fetch todo: ${result.error.kind}` };
  }

  const { statusCode, body } = result.value;

  if (statusCode === 404) {
    return { data: null, error: 'Todo not found' };
  }

  return { data: body as TodoItem, error: null };
}

async function createTodo(payload: CreateTodoPayload): ApiResult<TodoItem> {
  const result = await client.request({
    path: '/todos',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: payload,
    expectedCodes: [HTTP_CREATED, HTTP_OK]
  });

  if (!result.ok) {
    if (result.error.kind === 'invalid_json') {
      return { data: null, error: 'Invalid response from server' };
    }

    return { data: null, error: `Failed to create todo: ${result.error.kind}` };
  }

  return { data: result.value as TodoItem, error: null };
}

async function updateTodo(
  id: number,
  payload: UpdateTodoPayload
): ApiResult<TodoItem> {
  const result = await client.client({
    path: `/todos/${id}`,
    method: 'PATCH',
    body: payload,
    expectedCodes: [HTTP_OK, 404]
  });

  if (!result.ok) {
    return { data: null, error: `Failed to update todo: ${result.error.kind}` };
  }

  const { statusCode, body } = result.value;

  if (statusCode === 404) {
    return { data: null, error: 'Todo not found' };
  }

  return { data: body as TodoItem, error: null };
}

async function deleteTodo(id: number): ApiResult<null> {
  const result = await client.client({
    path: `/todos/${id}`,
    method: 'DELETE',
    expectedCodes: [HTTP_NO_CONTENT, HTTP_OK, 404]
  });

  if (!result.ok) {
    return { data: null, error: `Failed to delete todo: ${result.error.kind}` };
  }

  const { statusCode } = result.value;

  if (statusCode === 404) {
    return { data: null, error: 'Todo not found' };
  }

  return { data: null, error: null };
}

// ============================================================================
// Usage Examples
// ============================================================================

async function main() {
  console.log('=== Listing Todos ===');
  const listResult = await listTodos();
  if (listResult.error) {
    console.error(listResult.error);
  } else {
    console.log(`Found ${listResult.data?.length || 0} todos`);
  }

  console.log('\n=== Getting Single Todo ===');
  const getResult = await getTodo(1);
  if (getResult.error) {
    console.error(getResult.error);
  } else {
    console.log('Todo:', getResult.data);
  }

  console.log('\n=== Creating Todo ===');
  const createResult = await createTodo({ title: 'Learn Trembita' });
  if (createResult.error) {
    console.error(createResult.error);
  } else {
    console.log('Created:', createResult.data);
  }

  console.log('\n=== Updating Todo ===');
  const updateResult = await updateTodo(1, { completed: true });
  if (updateResult.error) {
    console.error(updateResult.error);
  } else {
    console.log('Updated:', updateResult.data);
  }

  console.log('\n=== Deleting Todo ===');
  const deleteResult = await deleteTodo(1);
  if (deleteResult.error) {
    console.error(deleteResult.error);
  } else {
    console.log('Deleted successfully');
  }
}

// Run if this file is executed directly
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch(console.error);
}

export { listTodos, getTodo, createTodo, updateTodo, deleteTodo };
