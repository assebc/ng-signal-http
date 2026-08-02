import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { graphqlQuery, graphqlMutation } from './graphql-signal';
import { GraphQLRequestError } from './graphql-error';
import { SignalHttpClient } from '../core/signal-http-client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockExecuteRequest(impl: (config: unknown) => Promise<unknown>) {
  return vi.spyOn(
    TestBed.inject(SignalHttpClient) as { executeRequest: (...args: unknown[]) => unknown },
    'executeRequest'
  ).mockImplementation(impl as never);
}

function gqlOk<T>(data: T) {
  return Promise.resolve({ data });
}

function gqlErrors(...messages: string[]) {
  return Promise.resolve({ errors: messages.map(message => ({ message })) });
}

function setup() {
  @Component({ template: '', standalone: true })
  class Host {}
  TestBed.configureTestingModule({ imports: [Host] });
  return TestBed.createComponent(Host);
}

// ─── graphqlQuery ─────────────────────────────────────────────────────────────

describe('graphqlQuery()', () => {
  beforeEach(() => { setup(); });
  afterEach(() => TestBed.resetTestingModule());

  it('unwraps data and sets the data signal on success', async () => {
    mockExecuteRequest(() => gqlOk({ users: [{ id: 1 }] }));

    const result = TestBed.runInInjectionContext(() =>
      graphqlQuery<{ users: { id: number }[] }>('/graphql', 'query { users { id } }')
    );

    await vi.waitUntil(() => result.status() !== 'loading');
    expect(result.data()).toEqual({ users: [{ id: 1 }] });
    expect(result.status()).toBe('success');
  });

  it('sets the error signal when the response contains errors', async () => {
    mockExecuteRequest(() => gqlErrors('Not found', 'Forbidden'));

    const result = TestBed.runInInjectionContext(() =>
      graphqlQuery('/graphql', 'query { user { id } }')
    );

    await vi.waitUntil(() => result.status() !== 'loading');
    expect(result.status()).toBe('error');
    const err = result.error() as GraphQLRequestError;
    expect(err).toBeInstanceOf(GraphQLRequestError);
    expect(err.errors).toHaveLength(2);
    expect(err.message).toContain('Not found');
  });

  it('sets error when data is null in the response', async () => {
    mockExecuteRequest(() => Promise.resolve({ data: null }));

    const result = TestBed.runInInjectionContext(() =>
      graphqlQuery('/graphql', 'query { user { id } }')
    );

    await vi.waitUntil(() => result.status() !== 'loading');
    expect(result.status()).toBe('error');
    expect(result.error()).toBeInstanceOf(GraphQLRequestError);
  });

  it('sends a POST request with the correct body', async () => {
    const spy = mockExecuteRequest(() => gqlOk({}));

    TestBed.runInInjectionContext(() =>
      graphqlQuery('/graphql', 'query { ping }', { variables: { id: 1 } })
    );

    await vi.waitUntil(() => spy.mock.calls.length > 0);
    const [config] = spy.mock.calls[0] as [{ method: string; body: unknown }];
    expect(config.method).toBe('POST');
    expect(config.body).toEqual({ query: 'query { ping }', variables: { id: 1 } });
  });

  it('calls onSuccess with the unwrapped data', async () => {
    mockExecuteRequest(() => gqlOk({ ping: true }));
    const onSuccess = vi.fn();

    const result = TestBed.runInInjectionContext(() =>
      graphqlQuery('/graphql', 'query { ping }', { onSuccess })
    );

    await vi.waitUntil(() => result.status() !== 'loading');
    expect(onSuccess).toHaveBeenCalledWith({ ping: true });
  });

  it('calls onError with a GraphQLRequestError', async () => {
    mockExecuteRequest(() => gqlErrors('Oops'));
    const onError = vi.fn();

    const result = TestBed.runInInjectionContext(() =>
      graphqlQuery('/graphql', 'query { ping }', { onError })
    );

    await vi.waitUntil(() => result.status() !== 'loading');
    expect(onError).toHaveBeenCalledWith(expect.any(GraphQLRequestError));
  });

  it('re-fetches when reactive variables change', async () => {
    const userId = signal(1);

    @Component({ template: '', standalone: true })
    class Reactive {}
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [Reactive] });
    const fixture = TestBed.createComponent(Reactive);

    // Set up the spy AFTER the new module is configured so it targets the live instance.
    const spy = mockExecuteRequest((config: unknown) => {
      const { body } = config as { body: { variables: { id: number } } };
      return gqlOk({ user: { id: body.variables.id } });
    });

    const result = TestBed.runInInjectionContext(() =>
      graphqlQuery<{ user: { id: number } }, { id: number }>(
        '/graphql',
        'query GetUser($id: ID!) { user(id: $id) { id } }',
        { variables: () => ({ id: userId() }) }
      )
    );

    await vi.waitUntil(() => result.status() !== 'loading');
    expect(result.data()?.user.id).toBe(1);

    userId.set(2);
    fixture.detectChanges();
    TestBed.flushEffects();

    await vi.waitUntil(() => result.data()?.user.id === 2);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ─── graphqlMutation ──────────────────────────────────────────────────────────

describe('graphqlMutation()', () => {
  beforeEach(() => { setup(); });
  afterEach(() => TestBed.resetTestingModule());

  it('unwraps data and resolves with it', async () => {
    mockExecuteRequest(() => gqlOk({ createUser: { id: 42 } }));

    const mut = TestBed.runInInjectionContext(() =>
      graphqlMutation<{ createUser: { id: number } }, { name: string }>(
        '/graphql',
        'mutation CreateUser($name: String!) { createUser(name: $name) { id } }'
      )
    );

    const result = await mut.mutate({ name: 'Alice' });
    expect(result).toEqual({ createUser: { id: 42 } });
    expect(mut.data()).toEqual({ createUser: { id: 42 } });
  });

  it('sends the correct POST body', async () => {
    const spy = mockExecuteRequest(() => gqlOk({}));

    const mut = TestBed.runInInjectionContext(() =>
      graphqlMutation('/graphql', 'mutation Ping { ping }')
    );

    await mut.mutate({ x: 1 });
    const [config] = spy.mock.calls[0] as [{ method: string; body: unknown }];
    expect(config.method).toBe('POST');
    expect(config.body).toEqual({ query: 'mutation Ping { ping }', variables: { x: 1 } });
  });

  it('sets error signal and rejects when response contains errors', async () => {
    mockExecuteRequest(() => gqlErrors('Validation failed'));

    const mut = TestBed.runInInjectionContext(() =>
      graphqlMutation('/graphql', 'mutation Ping { ping }')
    );

    await expect(mut.mutate({})).rejects.toBeInstanceOf(GraphQLRequestError);
    expect(mut.error()).toBeInstanceOf(GraphQLRequestError);
    expect((mut.error() as GraphQLRequestError).errors[0].message).toBe('Validation failed');
  });

  it('calls onSuccess with the unwrapped data', async () => {
    mockExecuteRequest(() => gqlOk({ done: true }));
    const onSuccess = vi.fn();

    const mut = TestBed.runInInjectionContext(() =>
      graphqlMutation('/graphql', 'mutation Ping { ping }', { onSuccess })
    );

    await mut.mutate({});
    expect(onSuccess).toHaveBeenCalledWith({ done: true }, {});
  });

  it('calls onError with a GraphQLRequestError', async () => {
    mockExecuteRequest(() => gqlErrors('Bad input'));
    const onError = vi.fn();

    const mut = TestBed.runInInjectionContext(() =>
      graphqlMutation('/graphql', 'mutation Ping { ping }', { onError })
    );

    await expect(mut.mutate({})).rejects.toThrow();
    expect(onError).toHaveBeenCalledWith(expect.any(GraphQLRequestError), {}, undefined);
  });
});

// ─── GraphQLRequestError ──────────────────────────────────────────────────────

describe('GraphQLRequestError', () => {
  it('concatenates error messages', () => {
    const err = new GraphQLRequestError([{ message: 'A' }, { message: 'B' }]);
    expect(err.message).toBe('A; B');
    expect(err.name).toBe('GraphQLRequestError');
    expect(err.errors).toHaveLength(2);
  });
});
