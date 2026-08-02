import { DestroyRef, inject, signal } from '@angular/core';
import { SignalHttpClient } from '../core/signal-http-client';
import { MutationOptions, MutationResult } from '../types';
import { MutationFactory } from './mutation.types';

/**
 * Creates an imperative mutation bound to the current Angular injection context.
 *
 * Does nothing until `mutate(input)` is called. Calling `mutate()` while a previous
 * request is in flight cancels the previous request automatically.
 * The in-flight request is aborted when the host component or service is destroyed.
 *
 * Supports optimistic updates via `onMutate`: the callback fires before the network
 * request and its return value is passed as the rollback context to `onError`.
 *
 * @template TInput - The input type passed to `mutate()`.
 * @template TOutput - The response data type returned by the server.
 * @template TContext - Optional rollback context type returned by `onMutate`.
 * @param requestFactory - Receives the mutation input and returns a `RequestConfig`.
 * @param options - Optional lifecycle callbacks (`onMutate`, `onSuccess`, `onError`, `onSettled`).
 * @returns A `MutationResult<TInput, TOutput>` with reactive signals and a `mutate` trigger.
 *
 * @example
 * const createPost = mutationSignal<NewPost, Post>(
 *   (input) => ({ url: '/posts', method: 'POST', body: input }),
 *   { onSuccess: (post) => console.log('Created:', post.id) },
 * );
 *
 * // Trigger from an event handler:
 * await createPost.mutate({ title: 'Hello', body: 'World', userId: 1 });
 */
export function mutationSignal<TInput, TOutput, TContext = unknown>(
  requestFactory: MutationFactory<TInput>,
  options?: MutationOptions<TInput, TOutput, TContext>
): MutationResult<TInput, TOutput> {
  const httpClient = inject(SignalHttpClient);
  const destroyRef = inject(DestroyRef);

  const isPending = signal<boolean>(false);
  const error = signal<Error | null>(null);
  const data = signal<TOutput | null>(null);

  let abortController: AbortController | undefined;

  const mutate = async (input: TInput): Promise<TOutput> => {
    abortController?.abort();
    abortController = new AbortController();

    isPending.set(true);
    error.set(null);

    // onMutate fires before the network request for optimistic updates.
    // If it throws, bail early without firing the request.
    let context: TContext | undefined;
    if (options?.onMutate) {
      try {
        context = await options.onMutate(input);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        error.set(err);
        isPending.set(false);
        throw err;
      }
    }

    try {
      const config = requestFactory(input);
      const raw = await httpClient.executeRequest<unknown>({ ...config, signal: abortController.signal });
      const result = options?.select ? options.select(raw) : (raw as TOutput);

      data.set(result);
      options?.onSuccess?.(result, input);
      options?.onSettled?.(result, null, input);
      return result;

    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.set(err);
      options?.onError?.(err, input, context);
      options?.onSettled?.(null, err, input);
      throw err;

    } finally {
      isPending.set(false);
    }
  };

  destroyRef.onDestroy(() => {
    abortController?.abort();
  });

  return {
    isPending: isPending.asReadonly(),
    error: error.asReadonly(),
    data: data.asReadonly(),
    mutate,
    reset: () => {
      isPending.set(false);
      error.set(null);
      data.set(null);
    },
  };
}
