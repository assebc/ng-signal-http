import {
  DestroyRef,
  effect,
  inject,
  Injector,
  PLATFORM_ID,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ReconnectConfig, WebSocketOptions, WebSocketResult, WebSocketStatus } from './websocket.types';

type UrlFactory = () => string;

/**
 * Creates a reactive WebSocket connection bound to the current Angular injection context.
 *
 * Opens immediately and keeps the `data` signal updated with the latest message.
 * The socket is closed automatically when the host component or service is destroyed.
 *
 * Pass a signal-reading factory as the URL to reconnect automatically whenever
 * the URL changes (e.g. switching between rooms or topics).
 *
 * @template T - The expected message data type.
 * @param url - A static URL string or a factory whose signal reads are tracked.
 * @param options - Reconnect policy, custom deserialiser, lifecycle callbacks, etc.
 * @returns A `WebSocketResult<T>` with reactive signals and control methods.
 *
 * @example
 * // Static URL with auto-reconnect
 * const feed = websocketSignal<StockTick>('wss://api.example.com/feed', { reconnect: true });
 *
 * @example
 * // Reactive URL — reconnects when roomId() changes
 * const roomId = signal('general');
 * const chat = websocketSignal<ChatMessage>(() => `wss://api.example.com/rooms/${roomId()}`);
 */
export function websocketSignal<T>(
  url: string | UrlFactory,
  options?: WebSocketOptions<T>
): WebSocketResult<T> {
  const destroyRef = inject(DestroyRef);
  const injector = inject(Injector);
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  const factory: UrlFactory = typeof url === 'string' ? () => url : url;

  const data = signal<T | null>(options?.initialValue ?? null);
  const status = signal<WebSocketStatus>(isBrowser ? 'connecting' : 'closed');
  const error = signal<Event | null>(null);

  let currentWs: WebSocket | undefined;
  let intentionalClose = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const reconnectConfig: ReconnectConfig | false = (() => {
    if (!options?.reconnect) return false;
    if (options.reconnect === true) return {};
    return options.reconnect;
  })();

  const getReconnectDelay = (attempt: number): number => {
    if (!reconnectConfig) return 0;
    if (typeof reconnectConfig.delay === 'function') return reconnectConfig.delay(attempt);
    return (reconnectConfig.delay ?? 1000) * Math.pow(2, attempt - 1);
  };

  const deserialize = options?.deserialize ?? ((event: MessageEvent) => JSON.parse(event.data) as T);

  const connect = (resolvedUrl: string): void => {
    clearTimeout(reconnectTimer);
    currentWs?.close();

    if (!isBrowser) return;

    const ws = new WebSocket(resolvedUrl);
    currentWs = ws;
    status.set('connecting');

    ws.onopen = () => {
      if (ws !== currentWs) return;
      reconnectAttempt = 0;
      error.set(null);
      status.set('open');
      options?.onOpen?.();
    };

    ws.onmessage = (event: MessageEvent) => {
      if (ws !== currentWs) return;
      try {
        const parsed = deserialize(event);
        data.set(parsed);
        options?.onMessage?.(parsed);
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = (event: Event) => {
      if (ws !== currentWs) return;
      error.set(event);
      status.set('error');
      options?.onError?.(event);
    };

    ws.onclose = (event: CloseEvent) => {
      if (ws !== currentWs) return;
      status.set('closed');
      options?.onClose?.(event);

      if (intentionalClose || !reconnectConfig) return;

      const maxAttempts = reconnectConfig.maxAttempts ?? 5;
      if (reconnectAttempt >= maxAttempts) return;

      reconnectAttempt++;
      const delay = getReconnectDelay(reconnectAttempt);
      reconnectTimer = setTimeout(() => connect(resolvedUrl), delay);
    };
  };

  // Reactive effect — tracks signals in factory(), reconnects when they change.
  runInInjectionContext(injector, () => {
    effect(() => {
      const resolvedUrl = factory();
      intentionalClose = false;
      reconnectAttempt = 0;
      untracked(() => connect(resolvedUrl));
    });
  });

  destroyRef.onDestroy(() => {
    intentionalClose = true;
    clearTimeout(reconnectTimer);
    currentWs?.close();
  });

  return {
    data: data.asReadonly(),
    status: status.asReadonly(),
    error: error.asReadonly(),

    send: (value: unknown) => {
      if (currentWs?.readyState === WebSocket.OPEN) {
        currentWs.send(typeof value === 'string' ? value : JSON.stringify(value));
      }
    },

    close: () => {
      intentionalClose = true;
      clearTimeout(reconnectTimer);
      currentWs?.close();
    },

    reconnect: () => {
      intentionalClose = false;
      reconnectAttempt = 0;
      const resolvedUrl = untracked(factory);
      connect(resolvedUrl);
    },
  };
}
