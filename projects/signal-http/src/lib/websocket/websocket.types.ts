import { Signal } from '@angular/core';

export type WebSocketStatus = 'connecting' | 'open' | 'closed' | 'error';

/**
 * Reconnection configuration for `websocketSignal`.
 * When `true`, reconnects with default settings (up to 5 attempts, 1 s base delay with exponential back-off).
 */
export interface ReconnectConfig {
  /** Maximum number of reconnect attempts before giving up. Defaults to 5. */
  maxAttempts?: number;
  /** Delay in ms, or a factory that receives the attempt number (1-based). Defaults to `1000 * 2^(attempt-1)`. */
  delay?: number | ((attempt: number) => number);
}

/**
 * Options for `websocketSignal()`.
 *
 * @template T - The expected message data type.
 */
export interface WebSocketOptions<T> {
  /** Custom deserializer. Defaults to `JSON.parse(event.data)`. */
  deserialize?: (event: MessageEvent) => T;
  /**
   * Reconnect on unexpected close.
   * Pass `true` for defaults, or a `ReconnectConfig` to customise attempts and delay.
   */
  reconnect?: boolean | ReconnectConfig;
  /** Seed value before the first message arrives. */
  initialValue?: T;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (data: T) => void;
}

/**
 * State and control handle returned by `websocketSignal()`.
 *
 * @template T - The message data type.
 *
 * @example
 * const feed = websocketSignal<StockTick>('wss://api.example.com/feed', { reconnect: true });
 * effect(() => console.log(feed.status(), feed.data()));
 */
export interface WebSocketResult<T> {
  readonly data: Signal<T | null>;
  readonly status: Signal<WebSocketStatus>;
  readonly error: Signal<Event | null>;
  /** Send a value over the socket. JSON-serialised unless already a string. No-op when not open. */
  send: (data: unknown) => void;
  /** Close the connection and disable auto-reconnect. */
  close: () => void;
  /** Manually reconnect (resets the attempt counter). */
  reconnect: () => void;
}
