import { Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SignalHttpClient } from './signal-http-client';
import { provideSignalHttp } from './providers';
import { SIGNAL_HTTP_CONFIG } from './providers';
import { HttpError } from './http-error';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : String(status),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeTextResponse(text: string, status = 200): Response {
  return new Response(text, {
    status,
    statusText: 'OK',
    headers: { 'Content-Type': 'text/plain' },
  });
}

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function makeAbortError(): Error {
  return Object.assign(new Error('Aborted'), { name: 'AbortError' });
}

describe('SignalHttpClient', () => {
  let client: SignalHttpClient;

  beforeEach(() => {
    fetchMock.mockReset();
    TestBed.configureTestingModule({
      providers: [provideSignalHttp({ baseUrl: 'https://api.test.com' })],
    });
    client = TestBed.inject(SignalHttpClient);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // ─── executeRequest — response parsing ───────────────────────────────────

  describe('executeRequest — response parsing', () => {
    it('returns parsed JSON for application/json content-type', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1, name: 'Alice' }));
      const result = await client.executeRequest<{ id: number; name: string }>({
        url: '/users/1',
        method: 'GET',
      });
      expect(result).toEqual({ id: 1, name: 'Alice' });
    });

    it('returns plain text for non-JSON content-type', async () => {
      fetchMock.mockResolvedValueOnce(makeTextResponse('pong'));
      const result = await client.executeRequest<string>({ url: '/ping', method: 'GET' });
      expect(result).toBe('pong');
    });
  });

  // ─── executeRequest — URL building ───────────────────────────────────────

  describe('executeRequest — URL building', () => {
    it('prepends baseUrl for relative paths', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      await client.executeRequest({ url: '/users', method: 'GET' });
      expect(fetchMock).toHaveBeenCalledWith('https://api.test.com/users', expect.any(Object));
    });

    it('uses absolute URLs as-is', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      await client.executeRequest({ url: 'https://other.example.com/data', method: 'GET' });
      expect(fetchMock).toHaveBeenCalledWith('https://other.example.com/data', expect.any(Object));
    });

    it('appends query params', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      await client.executeRequest({
        url: '/search',
        method: 'GET',
        params: { q: 'foo', page: 2 },
      });
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('q=foo');
      expect(calledUrl).toContain('page=2');
    });

    it('skips query string when params is empty', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      await client.executeRequest({ url: '/items', method: 'GET', params: {} });
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('?');
    });
  });

  // ─── executeRequest — headers & body ─────────────────────────────────────

  describe('executeRequest — headers and body', () => {
    it('always sets Content-Type: application/json', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      await client.executeRequest({ url: '/test', method: 'GET' });
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    });

    it('merges per-request headers', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      await client.executeRequest({
        url: '/test',
        method: 'GET',
        headers: { 'X-Custom': 'value' },
      });
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect((init.headers as Record<string, string>)['X-Custom']).toBe('value');
    });

    it('JSON-serialises the request body', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1 }));
      await client.executeRequest({
        url: '/users',
        method: 'POST',
        body: { name: 'Bob', age: 30 },
      });
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.body).toBe(JSON.stringify({ name: 'Bob', age: 30 }));
    });

    it('omits body when not provided', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      await client.executeRequest({ url: '/items', method: 'GET' });
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.body).toBeUndefined();
    });
  });

  // ─── executeRequest — error handling ─────────────────────────────────────

  describe('executeRequest — error handling', () => {
    it('throws HttpError for non-ok responses', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
          headers: { 'Content-Type': 'text/plain' },
        })
      );
      await expect(
        client.executeRequest({ url: '/missing', method: 'GET' })
      ).rejects.toBeInstanceOf(HttpError);
    });

    it('HttpError carries the correct status code', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('', { status: 500, statusText: 'Server Error', headers: { 'Content-Type': 'text/plain' } })
      );
      const err = await client.executeRequest({ url: '/err', method: 'GET' }).catch((e) => e);
      expect((err as HttpError).status).toBe(500);
    });

    it('re-throws AbortError without going through error interceptors', async () => {
      const errorInterceptor = vi.fn((e: Error) => e);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideSignalHttp({ interceptors: [{ error: errorInterceptor }] }),
        ],
      });
      const c = TestBed.inject(SignalHttpClient);
      fetchMock.mockRejectedValueOnce(makeAbortError());

      await expect(
        c.executeRequest({ url: 'https://api.test.com/test', method: 'GET' })
      ).rejects.toMatchObject({ name: 'AbortError' });

      expect(errorInterceptor).not.toHaveBeenCalled();
    });

    it('wraps non-Error thrown values', async () => {
      fetchMock.mockRejectedValueOnce('plain string error');
      const err = await client.executeRequest({ url: '/test', method: 'GET' }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
    });
  });

  // ─── executeRequest — interceptors ───────────────────────────────────────

  describe('executeRequest — interceptors', () => {
    it('calls request interceptor before fetch', async () => {
      const requestInterceptor = vi.fn((c) => c);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideSignalHttp({ interceptors: [{ request: requestInterceptor }] })],
      });
      const c = TestBed.inject(SignalHttpClient);
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      await c.executeRequest({ url: 'https://api.test.com/test', method: 'GET' });
      expect(requestInterceptor).toHaveBeenCalledOnce();
    });

    it('request interceptor can modify config', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideSignalHttp({
            interceptors: [
              {
                request: (cfg) => ({
                  ...cfg,
                  headers: { ...cfg.headers, 'X-Intercepted': 'true' },
                }),
              },
            ],
          }),
        ],
      });
      const c = TestBed.inject(SignalHttpClient);
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      await c.executeRequest({ url: 'https://api.test.com/test', method: 'GET' });
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect((init.headers as Record<string, string>)['X-Intercepted']).toBe('true');
    });

    it('calls response interceptor after fetch', async () => {
      const responseInterceptor = vi.fn((r: Response) => r);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideSignalHttp({ interceptors: [{ response: responseInterceptor }] })],
      });
      const c = TestBed.inject(SignalHttpClient);
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      await c.executeRequest({ url: 'https://api.test.com/test', method: 'GET' });
      expect(responseInterceptor).toHaveBeenCalledOnce();
    });

    it('calls error interceptor on fetch failure', async () => {
      const errorInterceptor = vi.fn((e: Error) => e);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideSignalHttp({ interceptors: [{ error: errorInterceptor }] })],
      });
      const c = TestBed.inject(SignalHttpClient);
      fetchMock.mockRejectedValueOnce(new Error('network failure'));
      await c.executeRequest({ url: 'https://api.test.com/test', method: 'GET' }).catch(() => {});
      expect(errorInterceptor).toHaveBeenCalledOnce();
    });

    it('runs multiple interceptors in registration order', async () => {
      const order: number[] = [];
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideSignalHttp({
            interceptors: [
              { request: (c) => { order.push(1); return c; } },
              { request: (c) => { order.push(2); return c; } },
            ],
          }),
        ],
      });
      const c = TestBed.inject(SignalHttpClient);
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      await c.executeRequest({ url: 'https://api.test.com/test', method: 'GET' });
      expect(order).toEqual([1, 2]);
    });
  });

  // ─── Signal-returning methods ─────────────────────────────────────────────

  describe('get()', () => {
    it('starts as null before the fetch resolves', () => {
      fetchMock.mockReturnValueOnce(new Promise(() => {})); // never resolves
      let sig!: Signal<{ id: number } | null>;
      TestBed.runInInjectionContext(() => {
        sig = client.get<{ id: number }>('/users/1');
      });
      expect(sig()).toBeNull();
    });

    it('resolves to data after fetch completes', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1 }));
      let sig!: Signal<{ id: number } | null>;
      TestBed.runInInjectionContext(() => {
        sig = client.get<{ id: number }>('/users/1');
      });
      await flushPromises();
      expect(sig()).toEqual({ id: 1 });
    });

    it('stays null when the request fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'));
      let sig!: Signal<unknown>;
      TestBed.runInInjectionContext(() => {
        sig = client.get('/fail');
      });
      await flushPromises();
      expect(sig()).toBeNull();
    });

    it('calls fetch with GET method', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      TestBed.runInInjectionContext(() => {
        client.get('/items');
      });
      await flushPromises();
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('GET');
    });
  });

  describe('post()', () => {
    it('calls fetch with POST method', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ id: 1 }));
      TestBed.runInInjectionContext(() => {
        client.post('/users', { name: 'Alice' });
      });
      await flushPromises();
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ name: 'Alice' }));
    });
  });

  describe('put()', () => {
    it('calls fetch with PUT method', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      TestBed.runInInjectionContext(() => {
        client.put('/users/1', { name: 'Bob' });
      });
      await flushPromises();
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('PUT');
    });
  });

  describe('patch()', () => {
    it('calls fetch with PATCH method', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      TestBed.runInInjectionContext(() => {
        client.patch('/users/1', { name: 'Carol' });
      });
      await flushPromises();
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('PATCH');
    });
  });

  describe('delete()', () => {
    it('calls fetch with DELETE method', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      TestBed.runInInjectionContext(() => {
        client.delete('/users/1');
      });
      await flushPromises();
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('DELETE');
    });
  });
});
