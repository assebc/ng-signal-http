import { Injectable } from '@angular/core';
import { HttpInterceptor, SignalHttpPlugin } from '../types';

@Injectable({ providedIn: 'root' })
export class PluginService {
  private readonly _plugins: SignalHttpPlugin[] = [];

  register(plugins: SignalHttpPlugin[]): void {
    this._plugins.push(...plugins);
  }

  get interceptors(): HttpInterceptor[] {
    return this._plugins.flatMap(p => p.interceptors ?? []);
  }

  emitCacheSet(key: string, data: unknown): void {
    for (const p of this._plugins) p.onCacheSet?.(key, data);
  }

  emitCacheDelete(key: string): void {
    for (const p of this._plugins) p.onCacheDelete?.(key);
  }

  emitCacheClear(): void {
    for (const p of this._plugins) p.onCacheClear?.();
  }
}
