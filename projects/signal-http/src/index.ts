// Core, what consumers inject and configure (low level)
export { SignalHttpClient } from './lib/core/signal-http-client';
export { provideSignalHttp, providePersistentCache, SIGNAL_HTTP_CONFIG } from './lib/core/providers';
export { IdbCacheAdapter } from './lib/core/idb-cache';
export type { IdbCacheOptions } from './lib/core/idb-cache';
export { HttpError } from './lib/core/http-error';
export { HttpCacheService } from './lib/core/http-cache.service';
export type { CacheEntry } from './lib/core/http-cache.service';
export { withRequestLogging } from './lib/core/devtools';
export type { RequestLoggingOptions } from './lib/core/devtools';

// Reactive API
export { querySignal } from './lib/query/query-signal';
export { mutationSignal } from './lib/mutation/mutation-signal';
export { prefetchQuery } from './lib/query/prefetch-query';
export { paginatedQuerySignal } from './lib/query/paginated-query-signal';
export { parallelQueries } from './lib/query/parallel-queries';

// Types, everything a consumer might need to annotate their code
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
export type { PaginatedOptions, PaginatedResult } from './lib/query/paginated-query-signal';
export type { ParallelQueriesResult } from './lib/query/parallel-queries';
