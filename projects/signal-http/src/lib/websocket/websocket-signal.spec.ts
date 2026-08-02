import { Component, PLATFORM_ID, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { websocketSignal } from './websocket-signal';

// ─── Mock WebSocket ──────────────────────────────────────────────────────────

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  readyState = MockWebSocket.CONNECTING;
  readonly sent: unknown[] = [];

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: unknown): void { this.sent.push(data); }

  close(): void {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { wasClean: true, code: 1000 }));
  }

  // ── Test helpers ───────────────────────────────────────────────────────────
  open(): void { this.readyState = MockWebSocket.OPEN; this.onopen?.(new Event('open')); }
  message(data: unknown): void { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) })); }
  serverClose(code = 1001): void { this.readyState = MockWebSocket.CLOSED; this.onclose?.(new CloseEvent('close', { wasClean: false, code })); }
}

// ─── Test infrastructure ─────────────────────────────────────────────────────

function setup<T>(cb: () => ReturnType<typeof websocketSignal<T>>) {
  @Component({ template: '', standalone: true })
  class Host {}
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  // Run in the component's injector so DestroyRef is tied to fixture.destroy().
  const result = runInInjectionContext(fixture.componentRef.injector, cb);
  fixture.detectChanges();
  return { result, fixture, ws: () => MockWebSocket.instances[MockWebSocket.instances.length - 1] };
}

describe('websocketSignal()', () => {
  const originalWs = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();
    (globalThis as unknown as Record<string, unknown>)['WebSocket'] = MockWebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as Record<string, unknown>)['WebSocket'] = originalWs;
    TestBed.resetTestingModule();
  });

  // ─── initial state ────────────────────────────────────────────────────────

  it('status starts as "connecting" when a URL is provided', () => {
    const { result } = setup(() => websocketSignal('wss://example.com'));
    expect(result.status()).toBe('connecting');
  });

  it('data starts as null by default', () => {
    const { result } = setup(() => websocketSignal('wss://example.com'));
    expect(result.data()).toBeNull();
  });

  it('data starts with initialValue when provided', () => {
    const { result } = setup(() => websocketSignal('wss://x.com', { initialValue: 42 }));
    expect(result.data()).toBe(42);
  });

  // ─── connection lifecycle ─────────────────────────────────────────────────

  it('transitions to "open" when the socket opens', () => {
    const { result, ws } = setup(() => websocketSignal('wss://example.com'));
    ws().open();
    expect(result.status()).toBe('open');
  });

  it('calls onOpen callback when the socket opens', () => {
    const onOpen = vi.fn();
    const { ws } = setup(() => websocketSignal('wss://x.com', { onOpen }));
    ws().open();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('transitions to "closed" when the server closes', () => {
    const { result, ws } = setup(() => websocketSignal('wss://example.com'));
    ws().open();
    ws().serverClose(1000);
    expect(result.status()).toBe('closed');
  });

  it('calls onClose callback when the socket closes', () => {
    const onClose = vi.fn();
    const { ws } = setup(() => websocketSignal('wss://x.com', { onClose }));
    ws().open();
    ws().serverClose(1000);
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ─── messages ─────────────────────────────────────────────────────────────

  it('parses JSON messages and updates data signal', () => {
    const { result, ws } = setup(() => websocketSignal<{ id: number }>('wss://x.com'));
    ws().open();
    ws().message({ id: 1 });
    expect(result.data()).toEqual({ id: 1 });
  });

  it('calls onMessage callback for each message', () => {
    const onMessage = vi.fn();
    const { ws } = setup(() => websocketSignal<number>('wss://x.com', { onMessage }));
    ws().open();
    ws().message(42);
    expect(onMessage).toHaveBeenCalledWith(42);
  });

  it('does not throw on invalid JSON — data is unchanged', () => {
    const { result, ws } = setup(() => websocketSignal<number>('wss://x.com', { initialValue: 99 }));
    ws().open();
    ws().onmessage?.(new MessageEvent('message', { data: 'not-json' }));
    expect(result.data()).toBe(99);
  });

  it('supports a custom deserializer', () => {
    const { result, ws } = setup(() =>
      websocketSignal<string>('wss://x.com', {
        deserialize: (e) => (e.data as string).toUpperCase(),
      })
    );
    ws().open();
    ws().onmessage?.(new MessageEvent('message', { data: 'hello' }));
    expect(result.data()).toBe('HELLO');
  });

  // ─── send() ───────────────────────────────────────────────────────────────

  it('send() serialises objects to JSON', () => {
    const { result, ws } = setup(() => websocketSignal('wss://x.com'));
    ws().open();
    result.send({ type: 'ping' });
    expect(ws().sent).toEqual(['{"type":"ping"}']);
  });

  it('send() passes strings through unmodified', () => {
    const { result, ws } = setup(() => websocketSignal('wss://x.com'));
    ws().open();
    result.send('raw');
    expect(ws().sent).toEqual(['raw']);
  });

  it('send() is a no-op when the socket is not open', () => {
    const { result, ws } = setup(() => websocketSignal('wss://x.com'));
    // socket is still in CONNECTING state
    result.send({ type: 'ping' });
    expect(ws().sent).toHaveLength(0);
  });

  // ─── error ────────────────────────────────────────────────────────────────

  it('sets error signal and transitions to "error" on socket error', () => {
    const { result, ws } = setup(() => websocketSignal('wss://x.com'));
    ws().open();
    ws().onerror?.(new Event('error'));
    expect(result.status()).toBe('error');
    expect(result.error()).toBeInstanceOf(Event);
  });

  it('calls onError callback', () => {
    const onError = vi.fn();
    const { ws } = setup(() => websocketSignal('wss://x.com', { onError }));
    ws().onerror?.(new Event('error'));
    expect(onError).toHaveBeenCalledOnce();
  });

  // ─── close() ─────────────────────────────────────────────────────────────

  it('close() transitions to "closed" and disables reconnect', () => {
    const { result, ws } = setup(() =>
      websocketSignal('wss://x.com', { reconnect: true })
    );
    ws().open();
    result.close();
    vi.runAllTimers();
    expect(result.status()).toBe('closed');
    expect(MockWebSocket.instances).toHaveLength(1); // no new socket created
  });

  // ─── reconnect() ─────────────────────────────────────────────────────────

  it('reconnect() opens a new socket', () => {
    const { result, ws } = setup(() => websocketSignal('wss://x.com'));
    ws().open();
    ws().serverClose(1001);
    result.reconnect();
    expect(MockWebSocket.instances).toHaveLength(2);
    MockWebSocket.instances[1].open();
    expect(result.status()).toBe('open');
  });

  // ─── auto-reconnect ───────────────────────────────────────────────────────

  it('auto-reconnects after unexpected close when reconnect: true', () => {
    const { ws } = setup(() => websocketSignal('wss://x.com', { reconnect: true }));
    ws().open();
    ws().serverClose(1006);
    expect(MockWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1000); // first reconnect delay (attempt 1 → 1000ms)
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('respects maxAttempts and stops reconnecting after limit', () => {
    setup(() => websocketSignal('wss://x.com', { reconnect: { maxAttempts: 2, delay: 100 } }));
    const firstWs = MockWebSocket.instances[0];
    firstWs.serverClose(1006);
    vi.advanceTimersByTime(100);  // attempt 1
    MockWebSocket.instances[1].serverClose(1006);
    vi.advanceTimersByTime(200);  // attempt 2
    MockWebSocket.instances[2].serverClose(1006);
    vi.advanceTimersByTime(400);  // no more — maxAttempts reached
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('does not auto-reconnect when reconnect is not set', () => {
    const { ws } = setup(() => websocketSignal('wss://x.com'));
    ws().open();
    ws().serverClose(1006);
    vi.runAllTimers();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('uses a custom delay factory for reconnect timing', () => {
    const delay = vi.fn().mockReturnValue(500);
    const { ws } = setup(() => websocketSignal('wss://x.com', { reconnect: { delay } }));
    ws().open();
    ws().serverClose(1006);
    vi.advanceTimersByTime(499);
    expect(MockWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  // ─── reactive URL ─────────────────────────────────────────────────────────

  it('reconnects when the URL factory signal changes', () => {
    const room = signal('general');
    const { fixture, ws } = setup(() =>
      websocketSignal(() => `wss://x.com/rooms/${room()}`)
    );
    ws().open();
    expect(ws().url).toBe('wss://x.com/rooms/general');

    room.set('sports');
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1].url).toBe('wss://x.com/rooms/sports');
  });

  it('closes the previous socket when the URL changes', () => {
    const room = signal('general');
    const { fixture, ws } = setup(() =>
      websocketSignal(() => `wss://x.com/rooms/${room()}`)
    );
    ws().open();
    const firstWs = MockWebSocket.instances[0];

    room.set('news');
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(firstWs.readyState).toBe(WebSocket.CLOSED);
  });

  // ─── destroy ─────────────────────────────────────────────────────────────

  it('closes the socket when the component is destroyed', () => {
    const { fixture, ws } = setup(() => websocketSignal('wss://x.com'));
    ws().open();
    const sock = MockWebSocket.instances[0];
    fixture.destroy();
    expect(sock.readyState).toBe(WebSocket.CLOSED);
  });

  it('does not reconnect after component destroy', () => {
    const { fixture, ws } = setup(() =>
      websocketSignal('wss://x.com', { reconnect: { delay: 100 } })
    );
    ws().open();
    fixture.destroy(); // sets intentionalClose = true
    vi.runAllTimers();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  // ─── SSR ─────────────────────────────────────────────────────────────────

  it('status is "closed" and no socket is created on the server', () => {
    @Component({ template: '', standalone: true })
    class Host {}
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const fixture = TestBed.createComponent(Host);

    const result = runInInjectionContext(fixture.componentRef.injector, () =>
      websocketSignal('wss://x.com')
    );
    expect(result.status()).toBe('closed');
    expect(MockWebSocket.instances).toHaveLength(0);
  });
});
