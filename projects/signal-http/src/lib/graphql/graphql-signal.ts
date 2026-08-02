import { HttpClientResult, MutationResult } from '../types';
import { querySignal } from '../query/query-signal';
import { mutationSignal } from '../mutation/mutation-signal';
import { GraphQLMutationOptions, GraphQLQueryOptions, GraphQLResponse } from './graphql.types';
import { GraphQLRequestError } from './graphql-error';

function unwrapGql<TData>(raw: unknown): TData {
  const res = raw as GraphQLResponse<TData>;
  if (res.errors?.length) throw new GraphQLRequestError(res.errors);
  if (res.data === undefined || res.data === null) {
    throw new GraphQLRequestError([{ message: 'GraphQL response contained no data' }]);
  }
  return res.data;
}

/**
 * Reactive GraphQL query bound to the current Angular injection context.
 *
 * Wraps `querySignal` with GraphQL-specific request formatting (POST with
 * `{ query, variables }` body) and automatic response unwrapping.
 * GraphQL `errors` are surfaced via the `error` signal as `GraphQLRequestError`.
 *
 * Pass a signal-reading function as `variables` to make the query reactive —
 * it re-fetches whenever the signals inside the factory change.
 *
 * @template TData - Shape of `data` in the GraphQL response.
 * @template TVariables - Shape of the query variables.
 * @param endpoint - GraphQL endpoint URL.
 * @param document - GraphQL query string.
 * @param options - Query options including optional reactive `variables`.
 * @returns An `HttpClientResult<TData>` with reactive signals and control methods.
 *
 * @example
 * const users = graphqlQuery<{ users: User[] }>(
 *   '/graphql',
 *   `query { users { id name } }`,
 * );
 *
 * @example
 * // Reactive variables — re-fetches when userId() changes
 * const userId = signal(1);
 * const user = graphqlQuery<{ user: User }, { id: number }>(
 *   '/graphql',
 *   `query GetUser($id: ID!) { user(id: $id) { id name } }`,
 *   { variables: () => ({ id: userId() }) },
 * );
 */
export function graphqlQuery<TData, TVariables = Record<string, unknown>>(
  endpoint: string,
  document: string,
  options?: GraphQLQueryOptions<TData, TVariables>
): HttpClientResult<TData> {
  const variablesFactory =
    typeof options?.variables === 'function'
      ? (options.variables as () => TVariables)
      : () => options?.variables as TVariables | undefined;

  return querySignal<TData>(
    () => ({
      url: endpoint,
      method: 'POST',
      body: { query: document, variables: variablesFactory() },
      headers: { 'Content-Type': 'application/json' },
    }),
    {
      ...options,
      select: unwrapGql<TData>,
    }
  );
}

/**
 * Imperative GraphQL mutation bound to the current Angular injection context.
 *
 * Wraps `mutationSignal` with GraphQL-specific request formatting and automatic
 * response unwrapping. GraphQL `errors` are surfaced via the `error` signal as
 * `GraphQLRequestError`.
 *
 * @template TData - Shape of `data` in the GraphQL response.
 * @template TVariables - Input type passed to `mutate()`.
 * @template TContext - Optional rollback context from `onMutate`.
 * @param endpoint - GraphQL endpoint URL.
 * @param document - GraphQL mutation string.
 * @param options - Optional lifecycle callbacks.
 * @returns A `MutationResult<TVariables, TData>`.
 *
 * @example
 * const createUser = graphqlMutation<{ createUser: User }, { name: string }>(
 *   '/graphql',
 *   `mutation CreateUser($name: String!) { createUser(name: $name) { id name } }`,
 *   { onSuccess: (data) => console.log('Created:', data.createUser.id) },
 * );
 * await createUser.mutate({ name: 'Alice' });
 */
export function graphqlMutation<TData, TVariables = Record<string, unknown>, TContext = unknown>(
  endpoint: string,
  document: string,
  options?: GraphQLMutationOptions<TData, TVariables, TContext>
): MutationResult<TVariables, TData> {
  return mutationSignal<TVariables, TData, TContext>(
    (variables) => ({
      url: endpoint,
      method: 'POST',
      body: { query: document, variables },
      headers: { 'Content-Type': 'application/json' },
    }),
    {
      ...options,
      select: unwrapGql<TData>,
    }
  );
}
