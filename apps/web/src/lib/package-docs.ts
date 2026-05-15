export interface CodeExample {
  label: string;
  filename: string;
  code: string;
}

export interface PackageDoc {
  slug: string;
  name: string;
  npmName: string;
  version: string;
  icon: string;
  color: string;
  tagline: string;
  description: string;
  highlights: string[];
  examples: CodeExample[];
}

export const packageDocs: PackageDoc[] = [
  {
    slug: 'result',
    name: 'result',
    npmName: '@backendkit-labs/result',
    version: '0.1.3',
    icon: 'RE',
    color: '#4f7eff',
    tagline: 'Replace try/catch with typed, composable error values.',
    description:
      'Result<T, E> is the semantic base of the entire BackendKit suite. Errors become first-class values in your type signatures: the compiler enforces that callers handle both the success and failure paths, map/flatMap compose chains without nesting, and run() safely wraps any throwing third-party code.',
    highlights: [
      'Zero runtime dependencies',
      'map, flatMap, andThen, orElse, mapError',
      'run() catches exceptions at boundaries',
      'match() for declarative branching',
    ],
    examples: [
      {
        label: 'Basic',
        filename: 'user.service.ts',
        code: `import { ok, fail, type Result } from '@backendkit-labs/result';

interface User { id: string; name: string; email: string }
interface NotFoundError { type: 'not_found'; id: string }

async function getUser(id: string): Promise<Result<User, NotFoundError>> {
  const user = await db.users.findById(id);
  if (!user) return fail({ type: 'not_found', id });
  return ok(user);
}

const result = await getUser('usr_123');

if (result.ok) {
  console.log(result.value.name);  // TypeScript knows: User
} else {
  console.error(result.error.type); // TypeScript knows: 'not_found'
}`,
      },
      {
        label: 'Compose',
        filename: 'order.service.ts',
        code: `import { ok, fail, map, flatMap, type Result } from '@backendkit-labs/result';

// Chain operations — each step is fully type-safe
async function processOrder(
  id: string,
): Promise<Result<Invoice, OrderError | UserError | InvoiceError>> {
  const order = await getOrder(id);                // Result<Order, OrderError>
  const user  = await flatMap(order, getUser);     // Result<User, OrderError | UserError>
  const inv   = await flatMap(user, createInvoice); // Result<Invoice, ... | InvoiceError>
  return inv;
}

// Inline transform with map
const totalPrice = await getOrder('ord_1').then(r =>
  map(r, o => o.items.reduce((sum, item) => sum + item.price, 0)),
); // Result<number, OrderError>`,
      },
    ],
  },

  {
    slug: 'circuit-breaker',
    name: 'circuit-breaker',
    npmName: '@backendkit-labs/circuit-breaker',
    version: '0.1.2',
    icon: 'CB',
    color: '#f97316',
    tagline: 'Prevent cascading failures with intelligent error classification.',
    description:
      'Unlike other circuit breakers that treat all errors equally, @backendkit-labs/circuit-breaker lets you define which errors are infrastructure failures and which are business rejections — preventing phantom opens. Sliding-window tracking, half-open probing, built-in retry with jitter, and a CircuitBreakerRegistry with pre-tuned factory presets.',
    highlights: [
      'isFailure() classifies infra vs business errors',
      'Sliding-window failure tracking',
      'CircuitBreakerRegistry with presets',
      'Built-in retry with exponential backoff + jitter',
    ],
    examples: [
      {
        label: 'Basic',
        filename: 'stripe.service.ts',
        code: `import { CircuitBreaker } from '@backendkit-labs/circuit-breaker';

const cb = new CircuitBreaker({
  name: 'stripe',
  failureThreshold: 40,   // open after 40 % failure rate
  sampleSize: 20,         // measured over the last 20 calls
  cooldownMs: 30_000,     // wait 30 s before probing again
  // business errors don't count against the breaker
  isBusinessError: (err) => err.type === 'card_declined',
});

const result = await cb.execute(() => stripe.charges.create(dto));

if (result.ok) {
  return result.value;
} else if (result.error.type === 'circuit_open') {
  throw new ServiceUnavailableException('Payment service temporarily unavailable');
} else {
  throw new InternalServerErrorException(result.error.message);
}`,
      },
      {
        label: 'NestJS',
        filename: 'app.module.ts',
        code: `// app.module.ts
import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';

@Module({
  imports: [CircuitBreakerModule.forRoot()],
})
export class AppModule {}

// ----- payment.service.ts -----
@Injectable()
export class PaymentService {
  @UseCircuitBreaker({
    name: 'stripe',
    failureThreshold: 40,
    cooldownMs: 30_000,
  })
  async charge(dto: ChargeDto): Promise<Result<PaymentIntent, ChargeError>> {
    // The decorator wraps execution automatically —
    // result.error.type === 'circuit_open' when the breaker is open
    return this.stripeGateway.createCharge(dto);
  }
}`,
      },
    ],
  },

  {
    slug: 'bulkhead',
    name: 'bulkhead',
    npmName: '@backendkit-labs/bulkhead',
    version: '0.1.2',
    icon: 'BH',
    color: '#10b981',
    tagline: 'Limit concurrency. Queue the overflow. Shed excess load cleanly.',
    description:
      'Borrowed from naval architecture: isolate compartments so one breach does not sink the ship. Cap concurrent calls per downstream, queue the overflow with optional timeout, and shed excess load with a clean Result error — before you exhaust your connection pool. BulkheadRegistry provides pre-tuned presets for the four most common scenarios.',
    highlights: [
      'Per-service concurrency slots',
      'Wait queue with queueTimeoutMs',
      'BulkheadRegistry with presets',
      'BulkheadService aggregate metrics',
    ],
    examples: [
      {
        label: 'Basic',
        filename: 'api.service.ts',
        code: `import { Bulkhead } from '@backendkit-labs/bulkhead';

const bh = new Bulkhead({
  name: 'external-api',
  maxConcurrent: 10,  // at most 10 in-flight calls at once
  maxQueue: 50,       // up to 50 more can wait; the rest are rejected
});

const result = await bh.execute(() => externalApi.fetch(payload));

if (!result.ok) {
  if (result.error.type === 'bulkhead_full') {
    // Both slots and queue exhausted — shed the load cleanly
    throw new TooManyRequestsException('Downstream overloaded');
  }
  throw new BadGatewayException(result.error.message);
}

return result.value;`,
      },
      {
        label: 'NestJS',
        filename: 'external-api.service.ts',
        code: `@Injectable()
export class ExternalApiService {
  // Limit concurrency via decorator
  @UseBulkhead({ name: 'external-api', maxConcurrent: 10, maxQueue: 50 })
  async fetch(payload: FetchPayload): Promise<Result<ApiResponse, BulkheadError>> {
    return this.http.post<ApiResponse>('/api/data', payload);
  }

  // Stack with circuit breaker for full resilience
  @UseCircuitBreaker({ name: 'external-api', failureThreshold: 30 })
  @UseBulkhead({ name: 'external-api', maxConcurrent: 10 })
  async criticalFetch(
    id: string,
  ): Promise<Result<ApiResponse, ResilienceError>> {
    return this.http.get<ApiResponse>(\`/api/data/\${id}\`);
  }
}`,
      },
    ],
  },

  {
    slug: 'observability',
    name: 'observability',
    npmName: '@backendkit-labs/observability',
    version: '0.1.1',
    icon: 'OB',
    color: '#8b5cf6',
    tagline: 'Resilient structured logging, Prometheus metrics, and OTel spans.',
    description:
      'Not three tools bolted together — an integrated observability system. AsyncLocalStorage propagates the correlationId through the entire async chain without parameter threading. Telemetry transports are protected by an internal circuit breaker so a saturated log ingester never degrades your API. AllExceptionsFilter + ErrorMapper centralizes HTTP error responses.',
    highlights: [
      'Auto correlationId via AsyncLocalStorage',
      'Resilient transport with circuit breaker',
      '@TrackPerformance decorator',
      'AllExceptionsFilter + ErrorMapper',
    ],
    examples: [
      {
        label: 'Setup',
        filename: 'app.module.ts',
        code: `import { ObservabilityModule } from '@backendkit-labs/observability';

@Module({
  imports: [
    ObservabilityModule.forRoot({
      serviceName: 'payment-api',
      environment: process.env.NODE_ENV ?? 'development',
      logLevel: 'info',
      metrics: {
        enabled: true,
        port: 9090,          // Prometheus scrape endpoint
      },
      tracing: {
        enabled: true,
        exporterUrl: 'http://otel-collector:4317',  // OTLP gRPC
      },
    }),
  ],
})
export class AppModule {}`,
      },
      {
        label: 'Usage',
        filename: 'payment.service.ts',
        code: `@Injectable()
export class PaymentService {
  constructor(
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  // Automatically records operation duration as a histogram
  @WithMetrics({ operation: 'payment.charge' })
  async charge(dto: ChargeDto): Promise<Result<Payment, PaymentError>> {
    // correlationId is injected into every log line automatically
    this.logger.info('Processing charge', {
      userId: dto.userId,
      amount: dto.amount,
    });

    const result = await this.stripeGateway.charge(dto);

    if (!result.ok) {
      this.metrics.increment('payment.failures', { reason: result.error.type });
      this.logger.error('Charge failed', { error: result.error });
    }

    return result;
  }
}`,
      },
    ],
  },

  {
    slug: 'pipeline',
    name: 'pipeline',
    npmName: '@backendkit-labs/pipeline',
    version: '0.1.1',
    icon: 'PL',
    color: '#06b6d4',
    tagline: 'Type-safe orchestration with stop-on-first or collect-all modes.',
    description:
      'Orchestrate complex async workflows as a sequence of typed, immutable steps. Each handler enriches the context and returns a Result; the pipeline short-circuits on failure or collects all errors. Conditional steps with .pipeIf(), observability hooks per step, executedSteps in the result, and full NestJS DI via PipelineModule + definePipeline().',
    highlights: [
      'Stop-on-first or collect-all modes',
      '.pipeIf() for conditional steps',
      'Per-step observability hooks',
      'NestJS DI via definePipeline()',
    ],
    examples: [
      {
        label: 'Pipeline',
        filename: 'payment.pipeline.ts',
        code: `import { Pipeline } from '@backendkit-labs/pipeline';

interface PaymentContext {
  userId: string;
  amount: number;
  currency: string;
  card: CardDto;
  fraudScore?: number;  // added by CheckFraudHandler
  chargeId?: string;    // added by ChargeStripeHandler
}

const pipeline = new Pipeline<PaymentContext>()
  .pipe(new ValidateCardHandler())
  .pipe(new CheckFraudHandler())
  .pipe(new ChargeStripeHandler())
  .pipe(new SendReceiptHandler());

// Stops at the first failing handler
const result = await pipeline.run({
  userId, amount, currency: 'usd', card,
});

if (result.ok) {
  return { chargeId: result.value.chargeId };
} else {
  throw mapPipelineError(result.error);
}`,
      },
      {
        label: 'Handler',
        filename: 'check-fraud.handler.ts',
        code: `import { PipelineHandler } from '@backendkit-labs/pipeline';
import { ok, fail } from '@backendkit-labs/result';

export class CheckFraudHandler extends PipelineHandler<PaymentContext> {
  constructor(private readonly fraud: FraudService) {
    super();
  }

  async handle(
    ctx: PaymentContext,
  ): Promise<Result<PaymentContext, FraudError>> {
    const score = await this.fraud.score({
      userId: ctx.userId,
      amount: ctx.amount,
    });

    if (score > 80) {
      return fail({ type: 'fraud_detected', score, userId: ctx.userId });
    }

    // Return enriched context — the next handler sees fraudScore set
    return ok({ ...ctx, fraudScore: score });
  }
}`,
      },
    ],
  },

  {
    slug: 'http-client',
    name: 'http-client',
    npmName: '@backendkit-labs/http-client',
    version: '0.1.1',
    icon: 'HC',
    color: '#f59e0b',
    tagline: 'Every HTTP call returns Result<T, E> — no try/catch anywhere.',
    description:
      'Not just another HTTP client. Built on Axios for ecosystem compatibility, it integrates the full BackendKit stack: every response is Result<T, HttpClientError>, retries use exponential backoff + jitter, the circuit breaker uses isFailure() semantics, cancellation by key enables polling, and defineHttpClient<T>() creates fully-typed NestJS-injectable clients.',
    highlights: [
      'Result<T, HttpClientError> for every call',
      'Retry with exponential backoff + jitter',
      'Cancellation by key and mass cancel',
      'defineHttpClient<T>() for typed DI',
    ],
    examples: [
      {
        label: 'Basic',
        filename: 'github.client.ts',
        code: `import { HttpClient } from '@backendkit-labs/http-client';

const github = new HttpClient({
  baseUrl: 'https://api.github.com',
  timeout: 8_000,
  defaultHeaders: {
    Authorization: \`Bearer \${process.env.GITHUB_TOKEN}\`,
    Accept: 'application/vnd.github.v3+json',
  },
});

// Every response is Result<T, HttpClientError>
const result = await github.get<Repository>('/repos/owner/repo');

if (result.ok) {
  return result.value.stargazers_count; // typed Repository
}

// result.error.type: 'timeout' | 'network_error' | 'http_error'
if (result.error.type === 'http_error' && result.error.status === 404) {
  throw new NotFoundException('Repository not found');
}`,
      },
      {
        label: 'Resilient',
        filename: 'stripe.client.ts',
        code: `const stripe = new HttpClient({
  baseUrl: 'https://api.stripe.com/v1',
  timeout: 10_000,
  defaultHeaders: { Authorization: \`Bearer \${process.env.STRIPE_KEY}\` },
  retry: {
    attempts: 3,
    baseDelay: 500,          // 500 ms → 1 s → 2 s (exponential backoff)
    retryOn: ['network_error', 'timeout'],
  },
  circuitBreaker: {
    name: 'stripe',
    failureThreshold: 40,
    cooldownMs: 30_000,
  },
});

// POST with typed body and typed response
const result = await stripe.post<PaymentIntent>('/payment_intents', {
  amount: dto.amount,
  currency: dto.currency,
  customer: dto.customerId,
});

if (!result.ok) {
  this.logger.error('Stripe error', { type: result.error.type });
}`,
      },
    ],
  },

  {
    slug: 'request-scanner',
    name: 'request-scanner',
    npmName: '@backendkit-labs/request-scanner',
    version: '0.1.5',
    icon: 'SC',
    color: '#ef4444',
    tagline: 'Embedded WAF — blocks SQLi, XSS, NoSQL injection and more.',
    description:
      'An embedded Web Application Firewall that runs inside your Node.js process. 23 built-in rules across 6 attack categories. Recursively scans nested objects and object keys — crucial for detecting NoSQL operator injection like { "$where": ... }. maxDepth and maxStringLength caps prevent DoS via oversized payloads.',
    highlights: [
      '23 rules across 6 attack categories',
      'Recursive deep scan including object keys',
      'DoS protection via maxDepth limits',
      'Per-route @UseWafPipe() policies',
    ],
    examples: [
      {
        label: 'Middleware',
        filename: 'security.middleware.ts',
        code: `import { RequestScanner } from '@backendkit-labs/request-scanner';

const scanner = new RequestScanner({
  level: 'strict',               // 'permissive' | 'standard' | 'strict'
  allowList: ['/admin/raw-query'], // bypass specific trusted paths
});

// Works as Express / Fastify middleware
app.use((req, res, next) => {
  const threats = scanner.scan({
    body: req.body,
    query: req.query,
    headers: req.headers,
    path: req.path,
  });

  if (threats.length > 0) {
    return res.status(403).json({
      error: 'Request blocked',
      rule: threats[0].ruleId, // e.g. 'sql-001', 'xss-002'
    });
  }

  next();
});`,
      },
      {
        label: 'NestJS Guard',
        filename: 'scanner.guard.ts',
        code: `import { ScannerGuard } from '@backendkit-labs/request-scanner/nestjs';

@Injectable()
export class HttpScannerGuard extends ScannerGuard {
  protected getConfig(): ScannerConfig {
    return {
      level: 'strict',
      allowList: ['/api/admin/raw-query'],
    };
  }
}

// Apply globally or per-controller
@Controller('api')
@UseGuards(HttpScannerGuard)
export class ApiController {
  @Post('search')
  async search(@Body() dto: SearchDto) {
    // All injection attempts blocked before reaching here
    return this.service.search(dto);
  }
}`,
      },
    ],
  },
];
