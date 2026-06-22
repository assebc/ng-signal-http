import { InjectionToken, makeEnvironmentProviders, EnvironmentProviders } from '@angular/core';
import { SignalHttpConfig } from '../types';

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
      useValue: config
    }
  ]);
}