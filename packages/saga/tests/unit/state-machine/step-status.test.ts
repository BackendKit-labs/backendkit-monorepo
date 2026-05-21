import { isTerminalStepStatus, isFailureStepStatus } from '../../../src/state-machine/step-status';
import { StepStatus } from '../../../src/types/saga.types';

describe('step-status', () => {
  describe('isTerminalStepStatus', () => {
    it('should return true for SUCCEEDED', () => {
      expect(isTerminalStepStatus(StepStatus.SUCCEEDED)).toBe(true);
    });

    it('should return true for FAILED', () => {
      expect(isTerminalStepStatus(StepStatus.FAILED)).toBe(true);
    });

    it('should return true for COMPENSATED', () => {
      expect(isTerminalStepStatus(StepStatus.COMPENSATED)).toBe(true);
    });

    it('should return true for COMPENSATION_FAILED', () => {
      expect(isTerminalStepStatus(StepStatus.COMPENSATION_FAILED)).toBe(true);
    });

    it('should return false for PENDING', () => {
      expect(isTerminalStepStatus(StepStatus.PENDING)).toBe(false);
    });

    it('should return false for EXECUTING', () => {
      expect(isTerminalStepStatus(StepStatus.EXECUTING)).toBe(false);
    });
  });

  describe('isFailureStepStatus', () => {
    it('should return true for FAILED', () => {
      expect(isFailureStepStatus(StepStatus.FAILED)).toBe(true);
    });

    it('should return true for COMPENSATION_FAILED', () => {
      expect(isFailureStepStatus(StepStatus.COMPENSATION_FAILED)).toBe(true);
    });

    it('should return false for SUCCEEDED', () => {
      expect(isFailureStepStatus(StepStatus.SUCCEEDED)).toBe(false);
    });

    it('should return false for COMPENSATED', () => {
      expect(isFailureStepStatus(StepStatus.COMPENSATED)).toBe(false);
    });

    it('should return false for PENDING', () => {
      expect(isFailureStepStatus(StepStatus.PENDING)).toBe(false);
    });

    it('should return false for EXECUTING', () => {
      expect(isFailureStepStatus(StepStatus.EXECUTING)).toBe(false);
    });
  });
});
