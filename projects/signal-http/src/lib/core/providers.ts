import {
  APP_INITIALIZER,
  InjectionToken,
  makeEnvironmentProviders,
  EnvironmentProviders,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SignalHttpConfig } from '../types';
import { IdbCacheAdapter, IDB_CACHE_ADAPTER, IdbCacheOptions } from './idb-cache';
import { HttpCacheService } from './http-cache.service';
import { PluginService } from './plugin.service';

export const SIGNAL_HTTP_CONFIG = new InjectionToken<SignalHttpConfig>(
  'SIGNAL_HTTP_CONFIG'
);

/**
 * Registers `ng-signal-http` in an Angular application.
 * Call once in `app.config.ts` inside `ApplicationConfig.providers`.
 *
 * @param config - Global HTTP configuration applied to all requests.
 * @returns Angular `EnvironmentProviders` to add to your app config.
 *
 * @example
 * export const appConfig: ApplicationConfig = {
 *   providers: [provideSignalHttp({ baseUrl: 'https://api.example.com' })],
 * };
 */
export function provideSignalHttp(config: SignalHttpConfig = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SIGNAL_HTTP_CONFIG,
      useValue: config,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (plugins: PluginService) => () => {
        if (config.plugins?.length) plugins.register(config.plugins);
      },
      deps: [PluginService],
      multi: true,
    },
  ]);
}

/**
 * Enables IndexedDB persistence for the HTTP response cache.
 * Call alongside `provideSignalHttp()` in `app.config.ts`.
 *
 * On startup, cached entries are read from IndexedDB and loaded into the in-memory cache
 * so components can serve stale data instantly before any network request fires.
 * All subsequent `set`, `delete`, and `clear` calls are written through to IndexedDB.
 *
 * Safe to include in SSR apps — no IDB access happens on the server.
 *
 * @param options - Optional database and store name overrides.
 * @returns Angular `EnvironmentProviders` to add to your app config.
 *
 * @example
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideSignalHttp({ baseUrl: 'https://api.example.com' }),
 *     providePersistentCache({ dbName: 'my-app-cache' }),
 *   ],
 * };
 */
export function providePersistentCache(options?: IdbCacheOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: IDB_CACHE_ADAPTER,
      useFactory: (platformId: object) =>
        isPlatformBrowser(platformId) ? new IdbCacheAdapter(options) : null,
      deps: [PLATFORM_ID],
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (cache: HttpCacheService, adapter: IdbCacheAdapter | null) => async () => {
        if (!adapter) return;
        const entries = await adapter.getAll();
        for (const [key, entry] of entries) {
          cache.restore(key, entry);
        }
      },
      deps: [HttpCacheService, IDB_CACHE_ADAPTER],
      multi: true,
    },
  ]);
}
