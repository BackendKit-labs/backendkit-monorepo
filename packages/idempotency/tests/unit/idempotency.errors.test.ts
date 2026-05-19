import { describe, it, expect } from 'vitest';
import {
  IdempotencyPendingConflictError,
  IdempotencyKeyMissingError,
  IdempotencyKeyInvalidError,
} from '../../src/idempotency.errors.js';

describe('IdempotencyPendingConflictError', () => {
  it('has status 409', () => {
    const err = new IdempotencyPendingConflictError('my-key');
    expect(err.getStatus()).toBe(409);
  });

  it('includes the key in the message', () => {
    const err = new IdempotencyPendingConflictError('my-key');
    const body = err.getResponse() as { message: string };
    expect(body.message).toContain('my-key');
  });
});

describe('IdempotencyKeyMissingError', () => {
  it('has status 422', () => {
    const err = new IdempotencyKeyMissingError('idempotency-key');
    expect(err.getStatus()).toBe(422);
  });

  it('includes the header name in the message', () => {
    const err = new IdempotencyKeyMissingError('idempotency-key');
    const body = err.getResponse() as { message: string };
    expect(body.message).toContain('idempotency-key');
  });
});

describe('IdempotencyKeyInvalidError', () => {
  it('has status 422', () => {
    const err = new IdempotencyKeyInvalidError('idempotency-key');
    expect(err.getStatus()).toBe(422);
  });

  it('includes the header name in the message', () => {
    const err = new IdempotencyKeyInvalidError('idempotency-key');
    const body = err.getResponse() as { message: string };
    expect(body.message).toContain('idempotency-key');
  });
});
