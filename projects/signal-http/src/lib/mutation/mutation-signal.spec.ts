import { TestBed } from '@angular/core/testing';
import { mutationSignal } from './mutation-signal';
import { provideSignalHttp } from '../core/providers';
import { MutationResult } from '../types';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
  });
}

interface CreateUserInput {
  name: string;
}

interface UserOutput {
  id: number;
  name: string;
}

describe('mutationSignal', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    TestBed.configureTestingModule({
      providers: [provideSignalHttp({ baseUrl: 'https://api.test.com' })],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // ─── Initial state ──────────────────────────────────────────────────────

  describe('initial state', () => {
    it('isPending starts as false', () => {
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      expect(mut.isPending()).toBe(false);
    });

    it('error starts as null', () => {
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      expect(mut.error()).toBeNull();
    });

    it('data starts as null', () => {
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      expect(mut.data()).toBeNull();
    });
  });

  // ─── Successful mutation ────────────────────────────────────────────────

  describe('successful mutate()', () => {
    it('resolves with the response data', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1, name: 'Alice' }));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      const result = await mut.mutate({ name: 'Alice' });
      expect(result).toEqual({ id: 1, name: 'Alice' });
    });

    it('sets data signal to the response', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1, name: 'Alice' }));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      await mut.mutate({ name: 'Alice' });
      expect(mut.data()).toEqual({ id: 1, name: 'Alice' });
    });

    it('isPending is false after success', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1, name: 'Alice' }));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      await mut.mutate({ name: 'Alice' });
      expect(mut.isPending()).toBe(false);
    });

    it('error is null after success', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1, name: 'Alice' }));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      await mut.mutate({ name: 'Alice' });
      expect(mut.error()).toBeNull();
    });

    it('calls onSuccess with result and input', async () => {
      const onSuccess = vi.fn();
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1, name: 'Alice' }));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>(
          (input) => ({ url: '/users', method: 'POST', body: input }),
          { onSuccess }
        );
      });
      await mut.mutate({ name: 'Alice' });
      expect(onSuccess).toHaveBeenCalledWith({ id: 1, name: 'Alice' }, { name: 'Alice' });
    });

    it('calls onSettled with result, null error, and input', async () => {
      const onSettled = vi.fn();
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1, name: 'Alice' }));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>(
          (input) => ({ url: '/users', method: 'POST', body: input }),
          { onSettled }
        );
      });
      await mut.mutate({ name: 'Alice' });
      expect(onSettled).toHaveBeenCalledWith(
        { id: 1, name: 'Alice' },
        null,
        { name: 'Alice' }
      );
    });
  });

  // ─── Failed mutation ────────────────────────────────────────────────────

  describe('failed mutate()', () => {
    it('re-throws the error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('server error'));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      await expect(mut.mutate({ name: 'Alice' })).rejects.toThrow('server error');
    });

    it('sets error signal', async () => {
      fetchMock.mockRejectedValueOnce(new Error('server error'));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      expect(mut.error()).toBeInstanceOf(Error);
      expect(mut.error()?.message).toBe('server error');
    });

    it('isPending is false after failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('fail'));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      expect(mut.isPending()).toBe(false);
    });

    it('data stays null after failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('fail'));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      expect(mut.data()).toBeNull();
    });

    it('calls onError with error and input', async () => {
      const onError = vi.fn();
      const err = new Error('boom');
      fetchMock.mockRejectedValueOnce(err);
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>(
          (input) => ({ url: '/users', method: 'POST', body: input }),
          { onError }
        );
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      expect(onError).toHaveBeenCalledWith(err, { name: 'Alice' }, undefined);
    });

    it('calls onSettled with null data, the error, and input', async () => {
      const onSettled = vi.fn();
      const err = new Error('boom');
      fetchMock.mockRejectedValueOnce(err);
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>(
          (input) => ({ url: '/users', method: 'POST', body: input }),
          { onSettled }
        );
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      expect(onSettled).toHaveBeenCalledWith(null, err, { name: 'Alice' });
    });

    it('wraps non-Error thrown values in an Error', async () => {
      fetchMock.mockRejectedValueOnce('plain string');
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      expect(mut.error()).toBeInstanceOf(Error);
    });
  });

  // ─── reset() ───────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('clears data after success', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1, name: 'Alice' }));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      await mut.mutate({ name: 'Alice' });
      mut.reset();
      expect(mut.data()).toBeNull();
    });

    it('clears error after failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('fail'));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      mut.reset();
      expect(mut.error()).toBeNull();
    });

    it('sets isPending to false', async () => {
      fetchMock.mockRejectedValueOnce(new Error('fail'));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>((input) => ({
          url: '/users',
          method: 'POST',
          body: input,
        }));
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      mut.reset();
      expect(mut.isPending()).toBe(false);
    });
  });

  // ─── onMutate (optimistic updates) ──────────────────────────────────────

  describe('onMutate', () => {
    it('is called with the input before the network request fires', async () => {
      const onMutate = vi.fn().mockResolvedValue(undefined);
      let networkCalledAfterMutate = false;
      fetchMock.mockImplementation(() => {
        networkCalledAfterMutate = onMutate.mock.calls.length > 0;
        return Promise.resolve(makeJsonResponse({ id: 1, name: 'Alice' }));
      });
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>(
          (input) => ({ url: '/users', method: 'POST', body: input }),
          { onMutate }
        );
      });
      await mut.mutate({ name: 'Alice' });
      expect(onMutate).toHaveBeenCalledWith({ name: 'Alice' });
      expect(networkCalledAfterMutate).toBe(true);
    });

    it('passes the onMutate return value as context to onError on failure', async () => {
      const rollback = { snapshot: [1, 2, 3] };
      const onMutate = vi.fn().mockResolvedValue(rollback);
      const onError = vi.fn();
      fetchMock.mockRejectedValueOnce(new Error('server error'));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>(
          (input) => ({ url: '/users', method: 'POST', body: input }),
          { onMutate, onError }
        );
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        { name: 'Alice' },
        rollback
      );
    });

    it('passes undefined as context to onError when onMutate is not provided', async () => {
      const onError = vi.fn();
      fetchMock.mockRejectedValueOnce(new Error('boom'));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>(
          (input) => ({ url: '/users', method: 'POST', body: input }),
          { onError }
        );
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      expect(onError).toHaveBeenCalledWith(expect.any(Error), { name: 'Alice' }, undefined);
    });

    it('aborts the mutation without firing the network request when onMutate throws', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1, name: 'Alice' }));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>(
          (input) => ({ url: '/users', method: 'POST', body: input }),
          { onMutate: () => { throw new Error('optimistic failed'); } }
        );
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sets the error signal and clears isPending when onMutate throws', async () => {
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>(
          (input) => ({ url: '/users', method: 'POST', body: input }),
          { onMutate: () => { throw new Error('optimistic failed'); } }
        );
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      expect(mut.error()?.message).toBe('optimistic failed');
      expect(mut.isPending()).toBe(false);
    });

    it('does not call onError or onSettled when onMutate throws', async () => {
      const onError = vi.fn();
      const onSettled = vi.fn();
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>(
          (input) => ({ url: '/users', method: 'POST', body: input }),
          {
            onMutate: () => { throw new Error('optimistic failed'); },
            onError,
            onSettled,
          }
        );
      });
      await mut.mutate({ name: 'Alice' }).catch(noop);
      expect(onError).not.toHaveBeenCalled();
      expect(onSettled).not.toHaveBeenCalled();
    });
  });

  // ─── requestFactory integration ─────────────────────────────────────────

  describe('requestFactory', () => {
    it('passes input to the factory to build the request config', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      const factory = vi.fn((input: CreateUserInput) => ({
        url: `/users`,
        method: 'POST' as const,
        body: input,
      }));
      let mut!: MutationResult<CreateUserInput, UserOutput>;
      TestBed.runInInjectionContext(() => {
        mut = mutationSignal<CreateUserInput, UserOutput>(factory);
      });
      await mut.mutate({ name: 'Carol' });
      expect(factory).toHaveBeenCalledWith({ name: 'Carol' });
    });
  });
});
