export { SignalHttpClient } from './lib/core/signal-http-client';
export { provideSignalHttp, SIGNAL_HTTP_CONFIG } from './lib/core/providers';
export { HttpError } from './lib/core/http-error';

export { querySignal } from './lib/query/query-signal';
export { mutationSignal } from './lib/mutation/mutation-signal';

export type {
  SignalHttpConfig,
  HttpInterceptor,
  RequestConfig,
  RequestOptions,
  HttpMethod,
  RetryConfig,
  QueryStatus,
  QueryResult,
  MutationOptions,
  MutationResult,
} from './lib/types';

export type { UrlFactory } from './lib/query/query.types';
export type { MutationFactory } from './lib/mutation/mutation.types';