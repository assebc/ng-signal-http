import { APP_INITIALIZER } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { PluginService } from './plugin.service';
import { provideSignalHttp } from './providers';
import { SignalHttpPlugin } from '../types';

const runInitializers = async () => {
  const fns = TestBed.inject<Array<() => void | Promise<void>>>(APP_INITIALIZER as never, []);
  for (const fn of fns) await fn();
};

describe('PluginService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('starts with no plugins registered', () => {
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(PluginService);
    expect(svc.interceptors).toHaveLength(0);
  });

  it('register() adds plugins and exposes their interceptors', () => {
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(PluginService);
    const interceptor = { request: vi.fn() };
    svc.register([{ name: 'test', interceptors: [interceptor] }]);
    expect(svc.interceptors).toContain(interceptor);
  });

  it('emitCacheSet() calls onCacheSet on all plugins', () => {
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(PluginService);
    const p1 = { name: 'a', onCacheSet: vi.fn() };
    const p2 = { name: 'b', onCacheSet: vi.fn() };
    svc.register([p1, p2]);
    svc.emitCacheSet('GET:/users', []);
    expect(p1.onCacheSet).toHaveBeenCalledWith('GET:/users', []);
    expect(p2.onCacheSet).toHaveBeenCalledWith('GET:/users', []);
  });

  it('emitCacheDelete() calls onCacheDelete on all plugins', () => {
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(PluginService);
    const plugin = { name: 'a', onCacheDelete: vi.fn() };
    svc.register([plugin]);
    svc.emitCacheDelete('GET:/users');
    expect(plugin.onCacheDelete).toHaveBeenCalledWith('GET:/users');
  });

  it('emitCacheClear() calls onCacheClear on all plugins', () => {
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(PluginService);
    const plugin = { name: 'a', onCacheClear: vi.fn() };
    svc.register([plugin]);
    svc.emitCacheClear();
    expect(plugin.onCacheClear).toHaveBeenCalledOnce();
  });

  it('interceptors from multiple plugins are merged in registration order', () => {
    TestBed.configureTestingModule({});
    const svc = TestBed.inject(PluginService);
    const i1 = { request: vi.fn() };
    const i2 = { request: vi.fn() };
    svc.register([{ name: 'a', interceptors: [i1] }, { name: 'b', interceptors: [i2] }]);
    expect(svc.interceptors).toEqual([i1, i2]);
  });
});

describe('provideSignalHttp() plugin integration', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('registers plugins from config on APP_INITIALIZER', async () => {
    const plugin: SignalHttpPlugin = { name: 'test', onCacheSet: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideSignalHttp({ plugins: [plugin] })],
    });
    await runInitializers();

    const svc = TestBed.inject(PluginService);
    svc.emitCacheSet('key', 'data');
    expect(plugin.onCacheSet).toHaveBeenCalledWith('key', 'data');
  });

  it('does not register plugins when none are configured', async () => {
    TestBed.configureTestingModule({
      providers: [provideSignalHttp()],
    });
    await runInitializers();

    const svc = TestBed.inject(PluginService);
    expect(svc.interceptors).toHaveLength(0);
  });
});
