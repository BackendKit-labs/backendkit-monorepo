import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as winston                              from 'winston';
import { LoggerService }                         from '../../src/logger/logger.service.js';
import { CorrelationIdService }                  from '../../src/correlation/correlation.service.js';
import { ObservabilityOptions }                  from '../../src/observability.types.js';

vi.mock('winston', async () => {
  const actual = await vi.importActual<typeof winston>('winston');
  return {
    ...actual,
    createLogger: vi.fn(() => ({
      info:    vi.fn(),
      error:   vi.fn(),
      warn:    vi.fn(),
      debug:   vi.fn(),
      verbose: vi.fn(),
      log:     vi.fn(),
    })),
    format:     actual.format,
    transports: actual.transports,
  };
});

const opts: ObservabilityOptions = {
  serviceName: 'test-service',
  environment: 'test',
  logLevel:    'debug',
};

describe('LoggerService', () => {
  let svc:         LoggerService;
  let correlSvc:   CorrelationIdService;
  let winstonMock: ReturnType<typeof winston.createLogger>;

  beforeEach(async () => {
    vi.clearAllMocks();
    correlSvc  = new CorrelationIdService();
    svc        = new LoggerService(opts, correlSvc);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    winstonMock = (svc as any).winston;
  });

  it('calls winston.info on log()', () => {
    svc.log('hello');
    expect(winstonMock.info).toHaveBeenCalledWith('hello', expect.objectContaining({
      service: 'test-service',
    }));
  });

  it('calls winston.error on error()', () => {
    svc.error('boom', 'stack trace', 'SomeCtx');
    expect(winstonMock.error).toHaveBeenCalledWith('boom', expect.objectContaining({
      context: 'SomeCtx',
      trace:   'stack trace',
    }));
  });

  it('calls winston.warn on warn()', () => {
    svc.warn('careful');
    expect(winstonMock.warn).toHaveBeenCalledWith('careful', expect.any(Object));
  });

  it('includes correlationId from CorrelationIdService', () => {
    correlSvc.run('corr-123', () => {
      svc.log('msg');
    });
    expect(winstonMock.info).toHaveBeenCalledWith('msg', expect.objectContaining({
      correlationId: 'corr-123',
    }));
  });

  it('logWithMeta merges extra metadata', () => {
    svc.logWithMeta('info', 'custom', { userId: 'u1' });
    expect(winstonMock.log).toHaveBeenCalledWith('info', 'custom', expect.objectContaining({
      userId: 'u1',
    }));
  });

  it('works without an optional CorrelationIdService', () => {
    const svcNoCorrel = new LoggerService(opts);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inner = (svcNoCorrel as any).winston;
    svcNoCorrel.log('no-correl');
    expect(inner.info).toHaveBeenCalledWith('no-correl', expect.objectContaining({
      service: 'test-service',
    }));
  });

  // ── F3: logWithMeta level validation against whitelist ───────────

  it('logWithMeta accepts valid level "error"', () => {
    svc.logWithMeta('error', 'err msg', { errCode: 1 });
    expect(winstonMock.log).toHaveBeenCalledWith('error', 'err msg', expect.any(Object));
  });

  it('logWithMeta accepts valid level "warn"', () => {
    svc.logWithMeta('warn', 'warn msg', {});
    expect(winstonMock.log).toHaveBeenCalledWith('warn', 'warn msg', expect.any(Object));
  });

  it('logWithMeta accepts valid level "info"', () => {
    svc.logWithMeta('info', 'info msg', {});
    expect(winstonMock.log).toHaveBeenCalledWith('info', 'info msg', expect.any(Object));
  });

  it('logWithMeta accepts valid level "debug"', () => {
    svc.logWithMeta('debug', 'debug msg', {});
    expect(winstonMock.log).toHaveBeenCalledWith('debug', 'debug msg', expect.any(Object));
  });

  it('logWithMeta accepts valid level "verbose"', () => {
    svc.logWithMeta('verbose', 'verbose msg', {});
    expect(winstonMock.log).toHaveBeenCalledWith('verbose', 'verbose msg', expect.any(Object));
  });

  it('logWithMeta falls back to "info" for invalid level', () => {
    svc.logWithMeta('trace', 'trace msg', {});
    expect(winstonMock.log).toHaveBeenCalledWith('info', 'trace msg', expect.any(Object));
  });

  it('logWithMeta falls back to "info" for empty level', () => {
    svc.logWithMeta('', 'empty level', {});
    expect(winstonMock.log).toHaveBeenCalledWith('info', 'empty level', expect.any(Object));
  });

  it('logWithMeta falls back to "info" for uppercase level', () => {
    svc.logWithMeta('ERROR', 'uppercase', {});
    expect(winstonMock.log).toHaveBeenCalledWith('info', 'uppercase', expect.any(Object));
  });

  it('logWithMeta falls back to "info" for unknown level string', () => {
    svc.logWithMeta('silly', 'silly msg', {});
    expect(winstonMock.log).toHaveBeenCalledWith('info', 'silly msg', expect.any(Object));
  });
});
