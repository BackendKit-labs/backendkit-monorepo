export interface Package {
  slug: string;
  name: string;
  version: string;
  description: string;
  longDescription: string;
  icon: string;
  npmName: string;
  color: string;
  highlights: string[];
}

export const packages: Package[] = [
  {
    slug: 'result',
    name: 'result',
    version: '0.2.1',
    description: 'Type-safe Result monad. Replace try/catch with composable transformations.',
    longDescription:
      'Eliminate silent error paths forever. Result<T, E> makes every failure explicit in the type signature, composable with map/flatMap, and zero-overhead — no exceptions, no surprises.',
    icon: 'RE',
    npmName: '@backendkit-labs/result',
    color: '#4f7eff',
    highlights: ['Zero runtime deps', 'Composable transformations', 'Full TypeScript inference'],
  },
  {
    slug: 'circuit-breaker',
    name: 'circuit-breaker',
    version: '0.3.1',
    description: 'Sliding-window circuit breaker. Business vs infra error classification.',
    longDescription:
      'Protect your services from cascading failures. Sliding-window failure tracking with configurable thresholds, half-open probing, and intelligent error classification.',
    icon: 'CB',
    npmName: '@backendkit-labs/circuit-breaker',
    color: '#f97316',
    highlights: ['Sliding-window tracking', 'Error classification', 'NestJS integration'],
  },
  {
    slug: 'bulkhead',
    name: 'bulkhead',
    version: '0.2.1',
    description: 'Concurrency limiting. Isolates failures and prevents resource exhaustion.',
    longDescription:
      'Borrowed from naval architecture: isolate compartments so one breach does not sink the ship. Limit concurrent calls per service, queue excess, reject when full.',
    icon: 'BH',
    npmName: '@backendkit-labs/bulkhead',
    color: '#10b981',
    highlights: ['Concurrency limits', 'Queue management', 'Failure isolation'],
  },
  {
    slug: 'retry',
    name: 'retry',
    version: '0.1.2',
    description: 'Enterprise retry. Exponential backoff, sliding-window budget, circuit-breaker integration.',
    longDescription:
      'Never write a retry loop again. retry() returns Result<T, RetryError> and handles exponential backoff with jitter, per-attempt and global timeouts, sliding-window retry budgets, duck-typed circuit breaker and bulkhead integration, and lifecycle hooks for observability.',
    icon: 'RT',
    npmName: '@backendkit-labs/retry',
    color: '#f43f5e',
    highlights: ['Exponential backoff + jitter', 'Idempotency support', 'Circuit-breaker integration'],
  },
  {
    slug: 'pipeline',
    name: 'pipeline',
    version: '0.3.2',
    description: 'Type-safe async Chain of Responsibility. Stop-on-first / collect-all error modes.',
    longDescription:
      'Compose complex async workflows as a sequence of typed steps. Each handler receives the typed context, returns a Result, and the pipeline handles routing, early-exit, and error aggregation.',
    icon: 'PL',
    npmName: '@backendkit-labs/pipeline',
    color: '#06b6d4',
    highlights: ['Stop-on-first mode', 'Collect-all errors', 'Type-safe context'],
  },
  {
    slug: 'http-client',
    name: 'http-client',
    version: '0.2.0',
    description: 'HTTP client on axios. Every call returns Result<T,E>. Built-in circuit breaker + retry.',
    longDescription:
      'The HTTP client your services actually need. Built on axios with automatic retry with exponential backoff, integrated circuit breaker, structured error types, and every response as Result<T, HttpClientError>.',
    icon: 'HC',
    npmName: '@backendkit-labs/http-client',
    color: '#f59e0b',
    highlights: ['Result<T,E> responses', 'Built-in retry', 'Circuit breaker integration'],
  },
  {
    slug: 'auto-learning',
    name: 'auto-learning',
    version: '0.2.0',
    description: 'Adaptive resilience. Monitors traffic and auto-tunes circuit breaker, bulkhead, and timeouts.',
    longDescription:
      'Closes the feedback loop. Observes every request, detects anomalies with z-score analysis, and automatically adjusts your circuit breaker thresholds, bulkhead concurrency, and HTTP timeouts — no ML, no guesswork.',
    icon: 'AL',
    npmName: '@backendkit-labs/auto-learning',
    color: '#a855f7',
    highlights: ['Z-score anomaly detection', 'Auto-tunes CB + bulkhead', 'FileStorageAdapter'],
  },
  {
    slug: 'observability',
    name: 'observability',
    version: '0.1.1',
    description: 'Structured logging, metrics, correlation ID, OTel spans for NestJS.',
    longDescription:
      'Drop-in observability for NestJS. Winston-based structured logs, Prometheus metrics, automatic correlation IDs injected into every log line, and OpenTelemetry span propagation.',
    icon: 'OB',
    npmName: '@backendkit-labs/observability',
    color: '#8b5cf6',
    highlights: ['Structured logging', 'OTel spans', 'Correlation ID tracking'],
  },
  {
    slug: 'request-scanner',
    name: 'request-scanner',
    version: '0.1.5',
    description: 'Pattern-based request scanner. SQLi, XSS, Path Traversal, NoSQL, SSRF detection.',
    longDescription:
      'Defend at the edge. Scans every incoming request for SQL injection, XSS, Path Traversal, NoSQL injection, and SSRF patterns. Configurable severity levels, allow-lists, and NestJS guard integration.',
    icon: 'SC',
    npmName: '@backendkit-labs/request-scanner',
    color: '#ef4444',
    highlights: ['SQLi & XSS detection', 'SSRF protection', 'NestJS guard'],
  },
];
