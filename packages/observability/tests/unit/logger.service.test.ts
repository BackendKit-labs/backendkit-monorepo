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
});
