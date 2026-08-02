import { HttpClientOptions, MutationOptions } from '../types';

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<TData> {
  data?: TData | null;
  errors?: GraphQLError[];
}

/**
 * Options for `graphqlQuery()`.
 * Extends `HttpClientOptions` minus `select` (handled internally).
 *
 * @template TData - Shape of `data` in the GraphQL response.
 * @template TVariables - Shape of the query variables.
 */
export interface GraphQLQueryOptions<TData, TVariables = Record<string, unknown>>
  extends Omit<HttpClientOptions<TData>, 'select'> {
  /**
   * Query variables. Pass a signal-reading factory to make the query reactive —
   * changing signal values will trigger a re-fetch automatically.
   */
  variables?: TVariables | (() => TVariables);
}

/**
 * Options for `graphqlMutation()`.
 * Extends `MutationOptions` minus `select` (handled internally).
 *
 * @template TData - Shape of `data` in the GraphQL response.
 * @template TVariables - Input type passed to `mutate()`.
 * @template TContext - Optional rollback context from `onMutate`.
 */
export type GraphQLMutationOptions<
  TData,
  TVariables = Record<string, unknown>,
  TContext = unknown
> = Omit<MutationOptions<TVariables, TData, TContext>, 'select'>;
