import type { RetryCondition, AbortCondition, RetryErrorPayload } from '../retry/types.js';

/**
 * Default retry condition: retry on transient HTTP errors (429, 5xx),
 * network errors, timeouts, circuit-open, and bulkhead-rejected.
 */
export const defaultRetryCondition: RetryCondition = {
  shouldRetry(error: RetryErrorPayload): boolean {
    switch (error.type) {
      case 'http':
        return error.status === 429 || (error.status != null && error.status >= 500);
      case 'network':
      case 'timeout':
      case 'circuit-open':
      case 'bulkhead-rejected':
        return true;
      case 'business':
      case 'unknown':
        return false;
    }
  },
};

/**
 * Default abort condition: abort on 4xx client errors (except 429),
 * business errors, and permanent classifications.
 */
export const defaultAbortCondition: AbortCondition = {
  shouldAbort(error: RetryErrorPayload): boolean {
    switch (error.type) {
      case 'http':
        return error.status != null && error.status < 500 && error.status !== 429;
      case 'business':
        return true;
      case 'network':
      case 'timeout':
      case 'circuit-open':
      case 'bulkhead-rejected':
      case 'unknown':
        return false;
    }
  },
};
