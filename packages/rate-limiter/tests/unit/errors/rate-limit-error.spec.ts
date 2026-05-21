import { StoreError, AlgorithmError, ConfigError } from '../../../src/errors';

describe('RateLimitError types', () => {
  describe('StoreError', () => {
    it('should create with message and cause', () => {
      const cause = new Error('DB error');
      const error = new StoreError('Failed to write', cause);

      expect(error.message).toBe('Failed to write');
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('StoreError');
      expect(error.kind).toBe('store-error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(StoreError);
    });

    it('should create without cause', () => {
      const error = new StoreError('Generic store error');

      expect(error.message).toBe('Generic store error');
      expect(error.cause).toBeUndefined();
      expect(error.kind).toBe('store-error');
    });
  });

  describe('AlgorithmError', () => {
    it('should create with message', () => {
      const error = new AlgorithmError('Invalid algorithm state');

      expect(error.message).toBe('Invalid algorithm state');
      expect(error.name).toBe('AlgorithmError');
      expect(error.kind).toBe('algorithm-error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AlgorithmError);
    });
  });

  describe('ConfigError', () => {
    it('should create with message', () => {
      const error = new ConfigError('Missing required parameter');

      expect(error.message).toBe('Missing required parameter');
      expect(error.name).toBe('ConfigError');
      expect(error.kind).toBe('config-error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigError);
    });
  });

  describe('Type narrowing', () => {
    it('should narrow StoreError by kind', () => {
      const error: StoreError | AlgorithmError | ConfigError = new StoreError('test');

      if (error.kind === 'store-error') {
        expect(error.cause).toBeUndefined();
      } else {
        fail('Expected store-error kind');
      }
    });

    it('should narrow AlgorithmError by kind', () => {
      const error: StoreError | AlgorithmError | ConfigError = new AlgorithmError('test');

      if (error.kind === 'algorithm-error') {
        expect(error.message).toBe('test');
      } else {
        fail('Expected algorithm-error kind');
      }
    });

    it('should narrow ConfigError by kind', () => {
      const error: StoreError | AlgorithmError | ConfigError = new ConfigError('test');

      if (error.kind === 'config-error') {
        expect(error.message).toBe('test');
      } else {
        fail('Expected config-error kind');
      }
    });
  });
});
