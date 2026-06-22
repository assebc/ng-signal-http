import { TestBed } from '@angular/core/testing';
import { mutationSignal } from './mutation-signal';
import { provideSignalHttp } from '../core/providers';
import { MutationResult } from '../types';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

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
      await mut.mutate({ name: 'Alice' }).catch(() => {});
      expect(mut.error()).toBeInstanceOf(Error);
      expect(mut.error()!.message).toBe('server error');
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
      await mut.mutate({ name: 'Alice' }).catch(() => {});
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
      await mut.mutate({ name: 'Alice' }).catch(() => {});
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
      await mut.mutate({ name: 'Alice' }).catch(() => {});
      expect(onError).toHaveBeenCalledWith(err, { name: 'Alice' });
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
      await mut.mutate({ name: 'Alice' }).catch(() => {});
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
      await mut.mutate({ name: 'Alice' }).catch(() => {});
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
      await mut.mutate({ name: 'Alice' }).catch(() => {});
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
      await mut.mutate({ name: 'Alice' }).catch(() => {});
      mut.reset();
      expect(mut.isPending()).toBe(false);
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
