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
 * @template TInput - The input type passed to `mutate()`.
 * @template TOutput - The response data type returned by the server.
 * @param requestFactory - Receives the mutation input and returns a `RequestConfig`.
 * @param options - Optional lifecycle callbacks (`onSuccess`, `onError`, `onSettled`).
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
export function mutationSignal<TInput, TOutput>(
  requestFactory: MutationFactory<TInput>,
  options?: MutationOptions<TInput, TOutput>
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

    try {
      const config = requestFactory(input);
      const result = await httpClient.executeRequest<TOutput>({ ...config, signal: abortController.signal });

      data.set(result);
      options?.onSuccess?.(result, input);
      options?.onSettled?.(result, null, input);
      return result;

    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.set(err);
      options?.onError?.(err, input);
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
