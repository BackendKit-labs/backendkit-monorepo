import { describe, it, expect, vi, beforeEach }  from 'vitest';
import { HttpException, HttpStatus }              from '@nestjs/common';
import { AllExceptionsFilter, ErrorMapper }       from '../../src/filters/all-exceptions.filter.js';
import { LoggerService }                          from '../../src/logger/logger.service.js';

function makeLogger(): LoggerService {
  return {
    log:         vi.fn(),
    error:       vi.fn(),
    warn:        vi.fn(),
    debug:       vi.fn(),
    verbose:     vi.fn(),
    logWithMeta: vi.fn(),
  } as unknown as LoggerService;
}

function makeHost(statusFn: ReturnType<typeof vi.fn>) {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status: (code: number) => ({ json: statusFn.mockImplementation(body => ({ code, body })) }),
      }),
      getRequest: () => ({}),
    }),
  };
}

describe('AllExceptionsFilter', () => {
  let filter:   AllExceptionsFilter;
  let logger:   LoggerService;
  let statusFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logger   = makeLogger();
    filter   = new AllExceptionsFilter(logger, undefined);
    statusFn = vi.fn();
  });

  it('handles HttpException with correct status', () => {
    const host = makeHost(statusFn);
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host as never);
    expect(statusFn).toHaveBeenCalledWith(expect.objectContaining({ ok: false, statusCode: 404 }));
  });

  it('falls back to 500 for unknown errors', () => {
    const host = makeHost(statusFn);
    filter.catch(new Error('boom'), host as never);
    expect(statusFn).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
  });

  it('applies a custom error mapper', () => {
    class DomainError extends Error { code = 'DOMAIN_ERR'; }

    const mapper: ErrorMapper = err =>
      err instanceof DomainError
        ? { statusCode: 422, message: 'domain error', code: err.code }
        : null;

    filter.addMapper(mapper);
    const host = makeHost(statusFn);
    filter.catch(new DomainError('oops'), host as never);

    expect(statusFn).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 422,
      code: 'DOMAIN_ERR',
    }));
  });

  it('falls through to next mapper when first returns null', () => {
    const noop: ErrorMapper   = () => null;
    const catch500: ErrorMapper = () => ({ statusCode: 503, message: 'service unavailable' });

    filter.addMapper(noop).addMapper(catch500);
    const host = makeHost(statusFn);
    filter.catch(new Error('x'), host as never);

    expect(statusFn).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 503 }));
  });

  it('logs the error', () => {
    const host = makeHost(statusFn);
    filter.catch(new Error('logged'), host as never);
    expect(logger.error).toHaveBeenCalled();
  });

  // ── L2: mapped.message sanitized (supports arrays from validation pipe) ──

  it('joins array message from validation pipe into string', () => {
    const body = { message: ['name must be a string', 'age must be positive'] };
    const host = makeHost(statusFn);
    filter.catch(new HttpException(body, HttpStatus.BAD_REQUEST), host as never);

    expect(statusFn).toHaveBeenCalledWith(expect.objectContaining({
      message: 'name must be a string; age must be positive',
    }));
  });

  it('converts non-string message to string', () => {
    const body = { message: 42 };
    const host = makeHost(statusFn);
    filter.catch(new HttpException(body, HttpStatus.BAD_REQUEST), host as never);

    expect(statusFn).toHaveBeenCalledWith(expect.objectContaining({
      message: '42',
    }));
  });

  it('handles string body directly', () => {
    const host = makeHost(statusFn);
    filter.catch(new HttpException('simple error', HttpStatus.BAD_REQUEST), host as never);

    expect(statusFn).toHaveBeenCalledWith(expect.objectContaining({
      message: 'simple error',
    }));
  });

  it('handles HttpException with missing message field', () => {
    // When HttpException receives an object body without a `message` field,
    // NestJS uses the exception's own message ("Http Exception").
    // The filter then falls back to exception.message when body.message is absent.
    const body = { statusCode: 400, error: 'Bad Request' };
    const host = makeHost(statusFn);
    filter.catch(new HttpException(body, HttpStatus.BAD_REQUEST), host as never);

    expect(statusFn).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Http Exception',
    }));
  });
});
