import { withRequestLogging } from './devtools';
import { HttpInterceptor, RequestConfig } from '../types';

type SpyFn = ReturnType<typeof vi.fn>;

function makeSpyLogger() {
  const group = vi.fn() as unknown as Console['group'];
  const groupCollapsed = vi.fn() as unknown as Console['groupCollapsed'];
  const groupEnd = vi.fn() as unknown as Console['groupEnd'];
  const log = vi.fn() as unknown as Console['log'];
  const error = vi.fn() as unknown as Console['error'];
  return {
    logger: { group, groupCollapsed, groupEnd, log, error },
    spies: {
      group: group as unknown as SpyFn,
      groupCollapsed: groupCollapsed as unknown as SpyFn,
      groupEnd: groupEnd as unknown as SpyFn,
      log: log as unknown as SpyFn,
      error: error as unknown as SpyFn,
    },
  };
}

function makeConfig(overrides?: Partial<RequestConfig>): RequestConfig {
  return { url: '/test', method: 'GET', ...overrides };
}

function makeResponse(status = 200): Response {
  return new Response(JSON.stringify({}), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// withRequestLogging always returns all three hooks.
function getHooks(options?: Parameters<typeof withRequestLogging>[0]) {
  const interceptor = withRequestLogging(options);
  return {
    request: interceptor.request as NonNullable<HttpInterceptor['request']>,
    response: interceptor.response as NonNullable<HttpInterceptor['response']>,
    error: interceptor.error as NonNullable<HttpInterceptor['error']>,
  };
}

describe('withRequestLogging', () => {
  it('returns an object with request, response, and error hooks', () => {
    const interceptor: HttpInterceptor = withRequestLogging();
    expect(typeof interceptor.request).toBe('function');
    expect(typeof interceptor.response).toBe('function');
    expect(typeof interceptor.error).toBe('function');
  });

  describe('request hook', () => {
    it('returns the config unchanged', () => {
      const { logger } = makeSpyLogger();
      const { request } = getHooks({ logger });
      const config = makeConfig();
      const result = request(config);
      expect(result).toBe(config);
    });

    it('logs a single line in non-verbose mode', () => {
      const { logger, spies } = makeSpyLogger();
      const { request } = getHooks({ logger });
      request(makeConfig({ url: '/items', method: 'GET' }));
      expect(spies.log).toHaveBeenCalledWith('→ GET /items');
      expect(spies.groupCollapsed).not.toHaveBeenCalled();
    });

    it('logs a collapsed group in verbose mode', () => {
      const { logger, spies } = makeSpyLogger();
      const { request } = getHooks({ verbose: true, logger });
      const config = makeConfig({ url: '/items', method: 'POST' });
      request(config);
      expect(spies.groupCollapsed).toHaveBeenCalledWith('→ POST /items');
      expect(spies.log).toHaveBeenCalledWith(config);
      expect(spies.groupEnd).toHaveBeenCalled();
    });
  });

  describe('response hook', () => {
    it('returns the response unchanged', () => {
      const { logger } = makeSpyLogger();
      const { response } = getHooks({ logger });
      const resp = makeResponse(200);
      const result = response(resp);
      expect(result).toBe(resp);
    });

    it('logs the status code', () => {
      const { logger, spies } = makeSpyLogger();
      const { response } = getHooks({ logger });
      response(makeResponse(201));
      expect(spies.log).toHaveBeenCalledWith(expect.stringContaining('201'));
    });
  });

  describe('error hook', () => {
    it('re-throws the error (rejects the returned promise)', async () => {
      const { logger } = makeSpyLogger();
      const { error } = getHooks({ logger });
      const err = new Error('request failed');
      await expect(error(err) as Promise<never>).rejects.toThrow('request failed');
    });

    it('logs the error using console.error', async () => {
      const { logger, spies } = makeSpyLogger();
      const { error } = getHooks({ logger });
      const err = new Error('boom');
      await (error(err) as Promise<never>).catch(() => undefined);
      expect(spies.error).toHaveBeenCalledWith(err);
    });
  });

  describe('custom logger', () => {
    it('uses the provided logger instead of the global console', () => {
      const { logger, spies } = makeSpyLogger();
      const { request } = getHooks({ logger });
      request(makeConfig());
      expect(spies.log).toHaveBeenCalled();
    });
  });
});
