import { generateSagaId, generateCorrelationId, generateEventId } from '../../../src/utils/id-generator';

describe('id-generator', () => {
  describe('generateSagaId', () => {
    it('should return a string', () => {
      const id = generateSagaId();
      expect(typeof id).toBe('string');
    });

    it('should return a UUID v4 format string', () => {
      const id = generateSagaId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should return unique values on successive calls', () => {
      const id1 = generateSagaId();
      const id2 = generateSagaId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('generateCorrelationId', () => {
    it('should return a string', () => {
      const id = generateCorrelationId();
      expect(typeof id).toBe('string');
    });

    it('should return a UUID format string', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should return unique values on successive calls', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      expect(id1).not.toBe(id2);
    });

    it('should be different from saga id', () => {
      const sagaId = generateSagaId();
      const corrId = generateCorrelationId();

      expect(sagaId).not.toBe(corrId);
    });
  });

  describe('generateEventId', () => {
    it('should return a string', () => {
      const id = generateEventId();
      expect(typeof id).toBe('string');
    });

    it('should return unique values on successive calls', () => {
      const id1 = generateEventId();
      const id2 = generateEventId();

      expect(id1).not.toBe(id2);
    });
  });
});
