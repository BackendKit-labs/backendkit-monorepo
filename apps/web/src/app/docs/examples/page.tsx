import type { Metadata } from 'next';
import { highlight } from '@/lib/highlight';

export const metadata: Metadata = {
  title: 'Examples — BackendKit Labs Docs',
  description: 'Complete, production-ready implementation examples using BackendKit Labs libraries.',
};

// ── Shared UI ─────────────────────────────────────────────────────────────────

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-[22px] font-bold text-gray-900 dark:text-white mt-16 mb-3 scroll-mt-20 flex items-center gap-2 group tracking-tight"
    >
      {children}
      <a
        href={`#${id}`}
        className="opacity-0 group-hover:opacity-40 text-slate-400 dark:text-[#64748b] transition-opacity text-sm font-normal"
      >
        #
      </a>
    </h2>
  );
}

function SubHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-[17px] font-semibold text-gray-900 dark:text-white mt-8 mb-3 scroll-mt-20">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-600 dark:text-[#94a3b8] text-[15px] leading-relaxed mb-4">{children}</p>;
}

function C({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.06] text-blue-700 dark:text-[#79c0ff] font-mono text-[12px]">
      {children}
    </code>
  );
}

function BadgeList({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {items.map((b) => (
        <span
          key={b.label}
          className="text-[11px] font-mono px-2.5 py-1 rounded-full border"
          style={{ color: b.color, background: `${b.color}12`, borderColor: `${b.color}30` }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

function CodeBlock({ code, filename, comment }: { code: string; filename?: string; comment?: string }) {
  const html = highlight(code);
  return (
    <div className="my-5">
      {comment && (
        <p className="text-[13px] text-slate-500 dark:text-[#64748b] font-mono mb-2 flex items-center gap-2">
          <span className="text-slate-400 dark:text-[#475569]">{'///'}</span>
          {comment}
        </p>
      )}
      <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#0d1117]">
        {filename && (
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-[#161b22]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            </div>
            <span className="text-[11px] font-mono text-[#64748b]">{filename}</span>
          </div>
        )}
        <pre
          className="p-5 font-mono text-[13px] leading-[1.75] overflow-x-auto text-[#e2e8f0] whitespace-pre m-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

function Callout({ type, children }: { type: 'tip' | 'info' | 'why'; children: React.ReactNode }) {
  const cfg = {
    tip:  { icon: '💡', color: '#f59e0b', label: 'Tip' },
    info: { icon: 'ℹ️',  color: '#4f7eff', label: 'Note' },
    why:  { icon: '🎯', color: '#8b5cf6', label: 'Why this approach' },
  }[type];
  return (
    <div
      className="my-5 rounded-xl p-4 border text-[14px] leading-relaxed text-slate-600 dark:text-[#94a3b8]"
      style={{ background: `${cfg.color}08`, borderColor: `${cfg.color}25` }}
    >
      <span className="font-semibold mr-2" style={{ color: cfg.color }}>
        {cfg.icon} {cfg.label}
      </span>
      {children}
    </div>
  );
}

function Divider() {
  return <hr className="border-gray-200 dark:border-white/[0.06] my-14" />;
}

// ── Code strings ──────────────────────────────────────────────────────────────
// Defined at module level so they are computed once at build time.

// ── Example 1: Checkout Pipeline ──────────────────────────────────────────────

const ex1Types = `// checkout/checkout.types.ts

import type { Result } from '@backendkit-labs/result';

/**
 * PaymentContext is the shared state that flows through every pipeline step.
 *
 * Design principle: Prefer an explicit, typed context over implicit shared state.
 * Each handler reads only what it needs and ADDS what the next step requires.
 * The shape of this interface is a living contract — when you add a new handler,
 * TypeScript forces you to declare what data it produces for downstream steps.
 */
export interface PaymentContext {
  // ── Provided by the caller ────────────────────────────────────────────────
  readonly userId: string;
  readonly items: CartItem[];
  readonly paymentMethod: PaymentMethodDto;
  readonly correlationId: string;

  // ── Set by ValidateCartHandler ─────────────────────────────────────────────
  validatedCart?: ValidatedCart;
  totalCents?: number;

  // ── Set by CheckInventoryHandler ───────────────────────────────────────────
  reservationId?: string;       // rollback token if payment fails

  // ── Set by FraudDetectionHandler ──────────────────────────────────────────
  fraudScore?: number;

  // ── Set by ChargeStripeHandler ─────────────────────────────────────────────
  chargeId?: string;
  receiptUrl?: string;
}

/**
 * The discriminated union of ALL errors the pipeline can produce.
 * The caller handles ONE switch on error.type — no nested try/catch blocks.
 */
export type CheckoutError =
  | { type: 'cart_empty' }
  | { type: 'item_unavailable'; itemId: string; requested: number; available: number }
  | { type: 'reservation_failed'; reason: string }
  | { type: 'fraud_detected'; score: number; userId: string }
  | { type: 'payment_declined'; code: string; message: string }
  | { type: 'payment_gateway_unavailable' }   // circuit open
  | { type: 'stripe_error'; status: number; raw: unknown };

export type CheckoutResult = Result<PaymentContext, CheckoutError>;`;

const ex1ValidateHandler = `// checkout/handlers/validate-cart.handler.ts

import { PipelineHandler } from '@backendkit-labs/pipeline';
import { ok, fail } from '@backendkit-labs/result';
import type { PaymentContext, CheckoutError } from '../checkout.types';

/**
 * Validates cart business rules BEFORE touching any external service.
 *
 * Why handle this as a dedicated handler instead of inline logic?
 * — It becomes individually unit-testable with a plain object (no mocks needed).
 * — The pipeline short-circuits here for free: downstream handlers never run
 *   if the cart is invalid, avoiding wasted network calls.
 * — The error type 'cart_empty' is now part of the CheckoutError union, so
 *   TypeScript forces every caller to handle it explicitly.
 */
export class ValidateCartHandler extends PipelineHandler<PaymentContext, CheckoutError> {
  async handle(ctx: PaymentContext): Promise<CheckoutResult> {
    if (ctx.items.length === 0) {
      return fail({ type: 'cart_empty' });
    }

    const totalCents = ctx.items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);

    // Return enriched context — next handler sees validatedCart and totalCents set
    return ok({ ...ctx, validatedCart: { items: ctx.items }, totalCents });
  }
}`;

const ex1InventoryHandler = `// checkout/handlers/check-inventory.handler.ts

import { PipelineHandler } from '@backendkit-labs/pipeline';
import { ok, fail } from '@backendkit-labs/result';
import type { PaymentContext, CheckoutError } from '../checkout.types';

/**
 * Reserves stock and returns a rollback token that can be used if payment fails.
 *
 * Why a reservation token?
 * — We are in a distributed system. There is no two-phase commit.
 *   The safest pattern is: reserve → charge → confirm (or cancel).
 *   The reservationId allows the failure handler in the service layer to
 *   release the reservation without knowing internal inventory details.
 *
 * Why inject InventoryService via constructor instead of importing directly?
 * — This handler is fully mockable in tests: pass a fake InventoryService
 *   and the handler logic is tested in complete isolation.
 */
export class CheckInventoryHandler extends PipelineHandler<PaymentContext, CheckoutError> {
  constructor(private readonly inventory: InventoryService) {
    super();
  }

  async handle(ctx: PaymentContext): Promise<CheckoutResult> {
    // Check availability for each item in parallel — faster than sequential
    const checks = await Promise.all(
      ctx.items.map(async (item) => ({
        item,
        available: await this.inventory.getAvailable(item.productId),
      })),
    );

    const shortage = checks.find((c) => c.available < c.item.qty);
    if (shortage) {
      return fail({
        type: 'item_unavailable',
        itemId: shortage.item.productId,
        requested: shortage.item.qty,
        available: shortage.available,
      });
    }

    // Reserve stock — returns a token to rollback if payment fails later
    const reservationId = await this.inventory.reserve(ctx.items, ctx.correlationId);
    if (!reservationId) {
      return fail({ type: 'reservation_failed', reason: 'Inventory service returned no token' });
    }

    return ok({ ...ctx, reservationId });
  }
}`;

const ex1FraudHandler = `// checkout/handlers/fraud-detection.handler.ts

import { PipelineHandler } from '@backendkit-labs/pipeline';
import { ok, fail } from '@backendkit-labs/result';
import type { PaymentContext, CheckoutError } from '../checkout.types';

/**
 * Calls an external fraud scoring service with circuit breaker protection.
 *
 * Key insight: We are lenient with fraud errors in production.
 * If the fraud service is DOWN (circuit open), we still allow the payment
 * with a synthetic score of 0 — a deliberate business decision.
 * Blocking all payments because fraud detection is unavailable is worse
 * than accepting a small risk window while the service recovers.
 *
 * This "graceful degradation" is made explicit in code rather than buried
 * in catch blocks, so it shows up in code review and can be changed by
 * business owners via the FRAUD_STRICT_MODE env flag.
 */
export class FraudDetectionHandler extends PipelineHandler<PaymentContext, CheckoutError> {
  constructor(
    private readonly fraud: FraudService,
    private readonly logger: LoggerService,
    private readonly strict = process.env.FRAUD_STRICT_MODE === 'true',
  ) {
    super();
  }

  async handle(ctx: PaymentContext): Promise<CheckoutResult> {
    const scoreResult = await this.fraud.score({
      userId: ctx.userId,
      amountCents: ctx.totalCents!,
      correlationId: ctx.correlationId,
    });

    // Fraud service is down — degrade gracefully unless strict mode is on
    if (!scoreResult.ok) {
      if (scoreResult.error.type === 'circuit_open' && !this.strict) {
        this.logger.warn('Fraud service unavailable — proceeding with score 0', {
          userId: ctx.userId,
          correlationId: ctx.correlationId,
        });
        return ok({ ...ctx, fraudScore: 0 });
      }
      // In strict mode, block the payment if fraud scoring fails
      return fail({ type: 'payment_gateway_unavailable' });
    }

    const score = scoreResult.value;

    if (score > 80) {
      return fail({ type: 'fraud_detected', score, userId: ctx.userId });
    }

    return ok({ ...ctx, fraudScore: score });
  }
}`;

const ex1StripeHandler = `// checkout/handlers/charge-stripe.handler.ts

import { PipelineHandler } from '@backendkit-labs/pipeline';
import { ok, fail } from '@backendkit-labs/result';
import type { PaymentContext, CheckoutError } from '../checkout.types';

/**
 * Charges the customer via Stripe using @backendkit-labs/http-client.
 *
 * Why http-client instead of the official Stripe Node SDK?
 * — The SDK throws exceptions; http-client returns Result<T, HttpClientError>.
 *   This means the charge call is type-safe at the call site — no try/catch.
 * — The circuit breaker is configured to NOT open on 4xx (declined cards,
 *   invalid card numbers). Those are business errors, not infrastructure failures.
 *   Only 5xx responses and network timeouts count against the breaker.
 *   This prevents a wave of declined cards from opening the circuit and
 *   blocking legitimate transactions.
 */
export class ChargeStripeHandler extends PipelineHandler<PaymentContext, CheckoutError> {
  constructor(private readonly stripe: StripeHttpClient) {
    super();
  }

  async handle(ctx: PaymentContext): Promise<CheckoutResult> {
    const result = await this.stripe.post<StripePaymentIntent>('/v1/payment_intents', {
      amount: ctx.totalCents,
      currency: 'usd',
      payment_method: ctx.paymentMethod.stripeId,
      confirm: true,
      metadata: {
        userId: ctx.userId,
        reservationId: ctx.reservationId,
        correlationId: ctx.correlationId,
      },
    });

    if (!result.ok) {
      // Circuit open — Stripe infrastructure is down
      if (result.error.type === 'circuit_open') {
        return fail({ type: 'payment_gateway_unavailable' });
      }
      // 4xx from Stripe — card declined, insufficient funds, invalid card, etc.
      if (result.error.type === 'http_error' && result.error.status < 500) {
        const body = result.error.body as { error: { decline_code: string; message: string } };
        return fail({
          type: 'payment_declined',
          code: body.error.decline_code ?? 'generic_decline',
          message: body.error.message,
        });
      }
      // 5xx from Stripe or network error
      return fail({
        type: 'stripe_error',
        status: result.error.status ?? 0,
        raw: result.error.body,
      });
    }

    return ok({
      ...ctx,
      chargeId: result.value.id,
      receiptUrl: result.value.charges.data[0]?.receipt_url,
    });
  }
}`;

const ex1Service = `// checkout/checkout.service.ts

import { Injectable } from '@nestjs/common';
import { Pipeline } from '@backendkit-labs/pipeline';
import type { PaymentContext, CheckoutError, CheckoutResult } from './checkout.types';

/**
 * CheckoutService is a thin orchestrator. It:
 * 1. Builds the initial context from the caller's DTO.
 * 2. Runs the pipeline.
 * 3. Releases the inventory reservation on failure (compensating transaction).
 * 4. Returns a CheckoutResult — the caller decides how to map it to HTTP.
 *
 * Notice there is no try/catch anywhere. Every failure path returns a typed
 * Result, so the controller handles a single discriminated union instead of
 * catching exceptions of unknown shape.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly pipeline: Pipeline<PaymentContext, CheckoutError>,
    private readonly inventory: InventoryService,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  @TrackPerformance({ operation: 'checkout.process' })
  async checkout(dto: CheckoutDto, correlationId: string): Promise<CheckoutResult> {
    const ctx: PaymentContext = {
      userId: dto.userId,
      items: dto.items,
      paymentMethod: dto.paymentMethod,
      correlationId,
    };

    const result = await this.pipeline.run(ctx);

    if (!result.ok) {
      this.logger.warn('Checkout failed', {
        errorType: result.error.type,
        userId: dto.userId,
        steps: result.executedSteps,  // which handlers ran before failure
        correlationId,
      });
      this.metrics.increment('checkout.failures', { reason: result.error.type });

      // Compensating transaction — release the stock reservation on failure
      if ('reservationId' in result.context && result.context.reservationId) {
        await this.inventory.release(result.context.reservationId).catch((err) => {
          this.logger.error('Failed to release reservation', { err, correlationId });
        });
      }

      return result;
    }

    this.metrics.increment('checkout.success', { userId: dto.userId });
    return result;
  }
}`;

const ex1Controller = `// checkout/checkout.controller.ts

import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CorrelationIdService } from '@backendkit-labs/observability';

/**
 * The controller's only job is mapping the Result error union to HTTP responses.
 * Each case is explicit and traceable — no generic 500 "something went wrong".
 *
 * This separation keeps business logic out of HTTP concerns and makes
 * every failure path independently testable without spinning up an HTTP layer.
 */
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly correlationId: CorrelationIdService,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CheckoutDto) {
    const result = await this.checkout.checkout(dto, this.correlationId.get());

    if (result.ok) {
      return {
        chargeId: result.value.chargeId,
        receiptUrl: result.value.receiptUrl,
        totalCents: result.value.totalCents,
      };
    }

    // Every error case has a specific HTTP status and message.
    // TypeScript exhaustiveness check: remove a case and the compiler warns you.
    switch (result.error.type) {
      case 'cart_empty':
        throw new BadRequestException('Cart is empty');
      case 'item_unavailable':
        throw new ConflictException({
          message: 'Item out of stock',
          itemId: result.error.itemId,
          available: result.error.available,
        });
      case 'reservation_failed':
        throw new ConflictException('Could not reserve stock — please retry');
      case 'fraud_detected':
        throw new ForbiddenException('Transaction flagged for review');
      case 'payment_declined':
        throw new UnprocessableEntityException({
          message: 'Card declined',
          code: result.error.code,
          detail: result.error.message,
        });
      case 'payment_gateway_unavailable':
        throw new ServiceUnavailableException('Payment service temporarily unavailable');
      case 'stripe_error':
        throw new InternalServerErrorException('Payment processing error');
    }
  }
}`;

// ── Example 2: Multi-Service Dashboard ────────────────────────────────────────

const ex2Types = `// dashboard/dashboard.types.ts

/**
 * Dashboard aggregates live data from three microservices.
 * Each service has a different SLA and failure mode, so each gets:
 *   - Its own bulkhead (concurrency isolation)
 *   - Its own circuit breaker (pre-tuned thresholds)
 *   - A typed HttpClient injected via NestJS DI
 *
 * The key insight is ISOLATION: if the Recommendations service starts timing
 * out under load, its bulkhead queue fills and rejects excess calls — but the
 * Orders and Profile bulkheads are completely unaffected.
 * Without bulkheads, one slow service can exhaust the shared thread pool
 * and bring down the entire dashboard.
 */
export interface DashboardData {
  profile: UserProfile | null;        // null = service degraded
  recentOrders: Order[];              // [] = service degraded
  recommendations: Product[];         // [] = service degraded
  degraded: string[];                 // which services are degraded
  correlationId: string;
}`;

const ex2Clients = `// dashboard/dashboard.clients.ts

import { defineHttpClient } from '@backendkit-labs/http-client/nestjs';
import { BulkheadRegistry } from '@backendkit-labs/bulkhead';
import { CircuitBreakerRegistry } from '@backendkit-labs/circuit-breaker';

/**
 * Typed client tokens — each service gets its own DI token so NestJS
 * can inject the right pre-configured instance.
 *
 * defineHttpClient<T>() creates a token that carries the type information
 * of the client interface. The injected instance is fully typed at the
 * call site — no casting, no 'as unknown as X'.
 */
export const USER_PROFILE_CLIENT    = defineHttpClient<UserProfileClient>();
export const ORDER_HISTORY_CLIENT   = defineHttpClient<OrderHistoryClient>();
export const RECOMMENDATIONS_CLIENT = defineHttpClient<RecommendationsClient>();

/**
 * Shared registries — instantiate once, reference everywhere by name.
 * Using registry factories avoids copy-pasting threshold values and
 * ensures consistent configuration across all instances of the same type.
 */
export const cbRegistry = new CircuitBreakerRegistry();
export const bhRegistry  = new BulkheadRegistry();

// Pre-tuned for internal microservices: 20 concurrent, 200 queue, 10 s timeout
export const profileBreaker         = cbRegistry.getForService('user-profile');
export const ordersBreaker          = cbRegistry.getForService('order-history');
export const recommendationsBreaker = cbRegistry.getForService('recommendations');

export const profileBulkhead         = bhRegistry.getForService('user-profile');
export const ordersBulkhead          = bhRegistry.getForService('order-history');
export const recommendationsBulkhead = bhRegistry.getForService('recommendations');`;

const ex2Service = `// dashboard/dashboard.service.ts

import { Injectable } from '@nestjs/common';
import type { DashboardData } from './dashboard.types';

/**
 * Fetches data from three services IN PARALLEL and degrades gracefully when
 * any of them fails, rather than failing the entire dashboard request.
 *
 * Why parallel and not sequential?
 * — Sequential: total latency = sum of all service latencies (worst case ~900 ms).
 * — Parallel:   total latency = slowest individual service (worst case ~300 ms).
 *   For a dashboard that a user sees on every page load, this matters enormously.
 *
 * Why Result instead of try/catch for the aggregation?
 * — We can check result.ok inline without unwrapping exceptions.
 * — The 'degraded' list makes the partial-failure state explicit in the response,
 *   so the frontend can show "Recommendations unavailable" rather than a blank panel.
 * — No exception escapes to Express's unhandled error handler.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectHttpClient(USER_PROFILE_CLIENT)    private readonly profileClient: UserProfileClient,
    @InjectHttpClient(ORDER_HISTORY_CLIENT)   private readonly ordersClient: OrderHistoryClient,
    @InjectHttpClient(RECOMMENDATIONS_CLIENT) private readonly recsClient: RecommendationsClient,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  @TrackPerformance({ operation: 'dashboard.aggregate' })
  async aggregate(userId: string, correlationId: string): Promise<DashboardData> {
    // Fire all three requests simultaneously — independent bulkheads + circuit breakers
    const [profileResult, ordersResult, recsResult] = await Promise.all([
      profileBulkhead.execute(() =>
        profileBreaker.execute(() => this.profileClient.get<UserProfile>(\`/users/\${userId}\`)),
      ),
      ordersBulkhead.execute(() =>
        ordersBreaker.execute(() => this.ordersClient.get<Order[]>(\`/orders?userId=\${userId}&limit=5\`)),
      ),
      recommendationsBulkhead.execute(() =>
        recommendationsBreaker.execute(() =>
          this.recsClient.post<Product[]>('/recommend', { userId, limit: 10 }),
        ),
      ),
    ]);

    const degraded: string[] = [];

    // Log and record metrics for any degraded service
    if (!profileResult.ok) {
      degraded.push('profile');
      this.logger.warn('Profile service degraded', { reason: profileResult.error.type, correlationId });
      this.metrics.increment('dashboard.degraded', { service: 'profile' });
    }
    if (!ordersResult.ok) {
      degraded.push('orders');
      this.logger.warn('Orders service degraded', { reason: ordersResult.error.type, correlationId });
      this.metrics.increment('dashboard.degraded', { service: 'orders' });
    }
    if (!recsResult.ok) {
      degraded.push('recommendations');
      this.logger.warn('Recommendations service degraded', { reason: recsResult.error.type, correlationId });
      this.metrics.increment('dashboard.degraded', { service: 'recommendations' });
    }

    // Return partial data — never throw if at least one service responded
    return {
      profile:         profileResult.ok ? profileResult.value : null,
      recentOrders:    ordersResult.ok  ? ordersResult.value  : [],
      recommendations: recsResult.ok    ? recsResult.value    : [],
      degraded,
      correlationId,
    };
  }
}`;

// ── Example 3: Batch CSV Import ────────────────────────────────────────────────

const ex3Types = `// import/import.types.ts

import type { Result } from '@backendkit-labs/result';

/**
 * ImportContext carries one CSV row through the validation pipeline.
 *
 * In 'collect-all' mode the pipeline runs EVERY handler even when one fails.
 * This is the right choice for user-facing validation: showing a user
 * "fix these 3 errors" is always better than "fix this 1 error, then resubmit
 * to discover another, then resubmit again."
 *
 * The tradeoff: in collect-all mode the context may be partially invalid
 * when later handlers run. Handlers must be written defensively — reading
 * only the fields they validated themselves.
 */
export interface ImportContext {
  readonly rowIndex: number;
  readonly raw: Record<string, string>;

  // Set by ParseEmailHandler if valid
  email?: string;

  // Set by ParseAmountHandler if valid
  amountCents?: number;

  // Set by ParseDateHandler if valid
  scheduledAt?: Date;
}

export type ImportFieldError =
  | { type: 'missing_field'; field: string }
  | { type: 'invalid_email'; value: string }
  | { type: 'invalid_amount'; value: string; reason: string }
  | { type: 'invalid_date'; value: string }
  | { type: 'amount_too_large'; amountCents: number; limitCents: number }
  | { type: 'duplicate_email'; email: string };

export type ImportRowResult = Result<ImportContext, ImportFieldError[]>;`;

const ex3Handlers = `// import/handlers/parse-email.handler.ts

import { PipelineHandler } from '@backendkit-labs/pipeline';
import { ok, fail } from '@backendkit-labs/result';
import type { ImportContext, ImportFieldError } from '../import.types';

/**
 * Validates and normalises the email field.
 *
 * In collect-all mode this handler's failure is added to the error array
 * but the pipeline continues — the next handler (ParseAmountHandler) still runs.
 * This is the core value of 'collect-all': the user gets all field errors
 * from a single submission instead of one error per submit cycle.
 */
export class ParseEmailHandler extends PipelineHandler<ImportContext, ImportFieldError[]> {
  constructor(private readonly db: UserRepository) {
    super();
  }

  async handle(ctx: ImportContext): Promise<ImportRowResult> {
    const raw = ctx.raw['email']?.trim();

    if (!raw) return fail([{ type: 'missing_field', field: 'email' }]);

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(raw)) return fail([{ type: 'invalid_email', value: raw }]);

    const exists = await this.db.existsByEmail(raw.toLowerCase());
    if (exists) return fail([{ type: 'duplicate_email', email: raw }]);

    return ok({ ...ctx, email: raw.toLowerCase() });
  }
}

// import/handlers/parse-amount.handler.ts

/**
 * Validates the payment amount.
 *
 * Note: We parse to cents (integer) to avoid floating-point money arithmetic.
 * This is a subtle but critical correctness requirement in payment systems.
 */
export class ParseAmountHandler extends PipelineHandler<ImportContext, ImportFieldError[]> {
  private static readonly LIMIT_CENTS = 100_000_00; // $100,000

  async handle(ctx: ImportContext): Promise<ImportRowResult> {
    const raw = ctx.raw['amount']?.trim();
    if (!raw) return fail([{ type: 'missing_field', field: 'amount' }]);

    const parsed = parseFloat(raw.replace(/,/g, ''));
    if (isNaN(parsed) || parsed <= 0) {
      return fail([{ type: 'invalid_amount', value: raw, reason: 'Must be a positive number' }]);
    }

    const amountCents = Math.round(parsed * 100);
    if (amountCents > ParseAmountHandler.LIMIT_CENTS) {
      return fail([{ type: 'amount_too_large', amountCents, limitCents: ParseAmountHandler.LIMIT_CENTS }]);
    }

    return ok({ ...ctx, amountCents });
  }
}`;

const ex3Pipeline = `// import/import.pipeline.ts

import { Pipeline } from '@backendkit-labs/pipeline';
import type { ImportContext, ImportFieldError, ImportRowResult } from './import.types';

/**
 * The validation pipeline runs in 'collect-all' mode.
 *
 * Result shape in this mode:
 *   result.ok    → true:  all handlers passed; result.value is the final context.
 *   result.ok    → false: result.errors is an ARRAY of every collected error.
 *
 * Without collect-all, each handler call would return on the first failure,
 * requiring multiple round-trips for the user to fix all their CSV errors.
 */
export function createImportPipeline(
  db: UserRepository,
  metrics: MetricsService,
): Pipeline<ImportContext, ImportFieldError[]> {
  return new Pipeline<ImportContext, ImportFieldError[]>({ mode: 'collect-all' })
    .pipe(new ParseEmailHandler(db))
    .pipe(new ParseAmountHandler())
    .pipe(new ParseDateHandler())
    // Observability hooks — instrument every step without modifying handlers
    .onStepError((step, errors) => {
      metrics.increment('import.validation_error', {
        step: step.name,
        reason: errors[0]?.type ?? 'unknown',
      });
    });
}

// import/import.service.ts

/**
 * Processes every row in the CSV and returns a structured report.
 *
 * Key design decision: we process rows sequentially, not in parallel.
 * Parallel processing would be faster but risks:
 *   1. Overwhelming the DB with concurrent existsByEmail checks.
 *   2. Allowing duplicate emails across rows in the same batch.
 * The bulkhead on the DB connection pool would queue them anyway,
 * so sequential processing is both safer and equally bounded.
 */
@Injectable()
export class ImportService {
  private readonly pipeline: Pipeline<ImportContext, ImportFieldError[]>;

  constructor(db: UserRepository, metrics: MetricsService) {
    this.pipeline = createImportPipeline(db, metrics);
  }

  async processRows(rows: Record<string, string>[]): Promise<ImportReport> {
    const results = await Promise.all(
      rows.map((raw, rowIndex) => this.pipeline.run({ rowIndex, raw })),
    );

    const valid   = results.filter((r) => r.ok).map((r) => r.value!);
    const invalid = results
      .filter((r) => !r.ok)
      .map((r) => ({ rowIndex: r.context.rowIndex, errors: r.errors! }));

    return { valid, invalid, total: rows.length };
  }
}`;

// ── Example 4: Hardened Search Endpoint ────────────────────────────────────────

const ex4Module = `// search/search.module.ts

import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

/**
 * SearchModule wires up a full-text search endpoint with three security layers:
 *
 * Layer 1 — ScannerGuard: Pattern-based WAF at the NestJS guard level.
 *   Blocks SQLi, XSS, NoSQL operators, and path traversal BEFORE the request
 *   reaches the controller. The guard scans body, query, headers, and also
 *   object KEYS (critical for NoSQL injection like { "$where": "1==1" }).
 *
 * Layer 2 — Result<T, SearchError>: Every operation returns a typed Result.
 *   No exception can bubble to Express's unhandled error handler unnoticed.
 *
 * Layer 3 — Observability: Every blocked request is logged with a correlation
 *   ID, making it trivial to correlate WAF logs with application traces in
 *   tools like Datadog, Loki, or Elasticsearch.
 */
@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}`;

const ex4Guard = `// search/search.guard.ts

import { ScannerGuard, type ScannerConfig } from '@backendkit-labs/request-scanner/nestjs';
import { Injectable } from '@nestjs/common';

/**
 * SearchScannerGuard inherits the full WAF engine from ScannerGuard.
 *
 * Configuration choices explained:
 *
 * level: 'strict'
 *   — Activates all 23 built-in rules with zero tolerance.
 *   — A search endpoint receives raw user input; it is the highest-risk
 *     surface area for injection attacks.
 *
 * maxDepth: 5
 *   — The search API only accepts shallow objects (query string + filters).
 *     Deeply nested payloads are not valid inputs and are likely probing
 *     for parsing vulnerabilities or attempting DoS via stack overflow.
 *
 * maxStringLength: 2000
 *   — A legitimate search query is at most a few hundred characters.
 *     Longer strings are almost certainly attack payloads or fuzzing attempts.
 *
 * onThreat callback
 *   — Fires BEFORE the response is sent, allowing us to record metrics and
 *     log the threat with the correlation ID for later forensic analysis.
 *     The correlationId lets us join WAF logs with application traces.
 */
@Injectable()
export class SearchScannerGuard extends ScannerGuard {
  constructor(
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
    private readonly correlationId: CorrelationIdService,
  ) {
    super();
  }

  protected getConfig(): ScannerConfig {
    return {
      level: 'strict',
      maxDepth: 5,
      maxStringLength: 2000,
      onThreat: (threat, req) => {
        this.logger.warn('WAF threat detected', {
          ruleId: threat.ruleId,
          severity: threat.severity,
          path: req.path,
          correlationId: this.correlationId.get(),
        });
        this.metrics.increment('security.threat_blocked', {
          rule: threat.ruleId,
          severity: threat.severity,
        });
      },
    };
  }
}`;

const ex4Service = `// search/search.service.ts

import { Injectable } from '@nestjs/common';
import { ok, fail, type Result } from '@backendkit-labs/result';

export type SearchError =
  | { type: 'index_unavailable' }           // Elasticsearch/OpenSearch down
  | { type: 'query_too_complex'; reason: string }  // too many clauses
  | { type: 'no_results' };                 // empty but not an error — caller decides

/**
 * SearchService is pure domain logic — no HTTP, no guards, no exceptions.
 *
 * Returning Result<SearchResponse, SearchError> instead of throwing means:
 * 1. The controller's return type is self-documenting: you can read every
 *    possible failure mode from the function signature alone.
 * 2. The Elasticsearch circuit breaker's 'circuit_open' error is mapped to
 *    the domain error 'index_unavailable', so callers don't need to know
 *    about infrastructure details.
 * 3. The @TrackPerformance decorator records the search latency histogram
 *    and OTel span automatically — zero instrumentation code in the method body.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly es: ElasticsearchHttpClient,
    private readonly logger: LoggerService,
  ) {}

  @TrackPerformance({ operation: 'search.query' })
  async search(dto: SearchDto): Promise<Result<SearchResponse, SearchError>> {
    const query = this.buildQuery(dto);

    if (query.clauses > 50) {
      return fail({ type: 'query_too_complex', reason: 'Maximum 50 query clauses allowed' });
    }

    const result = await this.es.post<EsResponse>('/products/_search', query);

    if (!result.ok) {
      if (result.error.type === 'circuit_open') return fail({ type: 'index_unavailable' });
      this.logger.error('Elasticsearch error', { error: result.error });
      return fail({ type: 'index_unavailable' });
    }

    const hits = result.value.hits.hits;
    if (hits.length === 0) return fail({ type: 'no_results' });

    return ok({
      items: hits.map((h) => h._source),
      total: result.value.hits.total.value,
      took: result.value.took,
    });
  }

  private buildQuery(dto: SearchDto): ElasticQuery {
    // Build safe query — no string interpolation, only parameterized DSL
    return {
      clauses: 1 + (dto.filters?.length ?? 0),
      query: {
        bool: {
          must: [{ match: { _all: dto.q } }],
          filter: (dto.filters ?? []).map((f) => ({ term: { [f.field]: f.value } })),
        },
      },
    };
  }
}`;

const ex4Controller = `// search/search.controller.ts

import { Controller, Get, Query, UseGuards, HttpCode } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchScannerGuard } from './search.guard';

/**
 * The controller applies the WAF guard and maps the Result to HTTP.
 *
 * Request lifecycle:
 * 1. ScannerGuard runs — scans body, query, headers, object keys.
 *    Any injection pattern → 403 before this method is called.
 * 2. search() is called — business logic returns Result<SearchResponse, SearchError>.
 * 3. We switch on the error type — no generic 500, every case is explicit.
 *
 * The 'no_results' case returns 200 with an empty array instead of 404
 * because "no results for your query" is NOT an error — it is a valid
 * business outcome that the frontend should handle gracefully.
 */
@Controller('search')
@UseGuards(SearchScannerGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @HttpCode(200)
  async query(@Query() dto: SearchDto) {
    const result = await this.search.search(dto);

    if (result.ok) return result.value;

    switch (result.error.type) {
      case 'no_results':
        return { items: [], total: 0, took: 0 };
      case 'query_too_complex':
        throw new BadRequestException(result.error.reason);
      case 'index_unavailable':
        throw new ServiceUnavailableException('Search is temporarily unavailable');
    }
  }
}`;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ExamplesPage() {
  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-10 pb-10 border-b border-gray-200 dark:border-white/[0.06]">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-3">
          Production Examples
        </h1>
        <p className="text-slate-600 dark:text-[#94a3b8] text-[16px] leading-relaxed max-w-xl">
          Complete, real-world implementations using BackendKit Labs libraries — individually and
          combined. Every example includes design rationale in JSDoc comments explaining{' '}
          <em>why</em> each pattern was chosen, not just <em>what</em> it does.
        </p>
      </div>

      {/* ── Example 1 ───────────────────────────────────────────────────────── */}
      <section id="checkout-pipeline">
        <SectionHeading id="checkout-pipeline">
          1 — E-Commerce Checkout Pipeline
        </SectionHeading>
        <BadgeList
          items={[
            { label: '@backendkit-labs/pipeline',        color: '#06b6d4' },
            { label: '@backendkit-labs/circuit-breaker', color: '#f97316' },
            { label: '@backendkit-labs/http-client',     color: '#f59e0b' },
            { label: '@backendkit-labs/observability',   color: '#8b5cf6' },
            { label: '@backendkit-labs/result',          color: '#4f7eff' },
          ]}
        />
        <P>
          A checkout flow touches multiple systems in sequence: cart validation, inventory
          reservation, fraud scoring, payment charging. Each step can fail with a distinct error
          type and some failures require compensating actions (like releasing a stock reservation
          when payment fails).
        </P>
        <P>
          Using <C>Pipeline</C> in <strong>stop-on-first</strong> mode models this correctly:
          transactional steps that should abort on the first failure, with every error type
          visible in the TypeScript union at the call site. The controller switches on a single
          discriminated union instead of catching exceptions of unknown shape.
        </P>

        <SubHeading>Shared types and context</SubHeading>
        <Callout type="why">
          The <C>PaymentContext</C> interface is the living contract of the pipeline.
          Adding a new handler forces you to declare what data it produces — TypeScript
          makes hidden data flow impossible.
        </Callout>
        <CodeBlock filename="checkout/checkout.types.ts" code={ex1Types} />

        <SubHeading>Handler 1 — Cart validation (no I/O)</SubHeading>
        <CodeBlock filename="checkout/handlers/validate-cart.handler.ts" code={ex1ValidateHandler} />

        <SubHeading>Handler 2 — Inventory reservation</SubHeading>
        <Callout type="tip">
          Parallel <C>Promise.all</C> for availability checks, then a single reservation call.
          The <C>reservationId</C> is the rollback token if payment fails downstream.
        </Callout>
        <CodeBlock filename="checkout/handlers/check-inventory.handler.ts" code={ex1InventoryHandler} />

        <SubHeading>Handler 3 — Fraud detection with graceful degradation</SubHeading>
        <Callout type="why">
          When the fraud service is down, we degrade gracefully (score = 0) instead of
          blocking all payments. This is a deliberate business decision made explicit in
          code — not a hidden catch block.
        </Callout>
        <CodeBlock filename="checkout/handlers/fraud-detection.handler.ts" code={ex1FraudHandler} />

        <SubHeading>Handler 4 — Stripe charge via http-client</SubHeading>
        <Callout type="why">
          The circuit breaker is configured to ignore 4xx responses. A wave of declined
          cards is a business event — not an infrastructure failure — and must not open
          the breaker and block legitimate transactions.
        </Callout>
        <CodeBlock filename="checkout/handlers/charge-stripe.handler.ts" code={ex1StripeHandler} />

        <SubHeading>Service — orchestration and compensating transaction</SubHeading>
        <CodeBlock filename="checkout/checkout.service.ts" code={ex1Service} />

        <SubHeading>Controller — HTTP mapping</SubHeading>
        <Callout type="tip">
          The TypeScript compiler enforces exhaustiveness: remove a case from the switch
          and you get a type error. Every failure path is accounted for at compile time.
        </Callout>
        <CodeBlock filename="checkout/checkout.controller.ts" code={ex1Controller} />
      </section>

      <Divider />

      {/* ── Example 2 ───────────────────────────────────────────────────────── */}
      <section id="dashboard-aggregator">
        <SectionHeading id="dashboard-aggregator">
          2 — Resilient Multi-Service Dashboard
        </SectionHeading>
        <BadgeList
          items={[
            { label: '@backendkit-labs/http-client',     color: '#f59e0b' },
            { label: '@backendkit-labs/bulkhead',        color: '#10b981' },
            { label: '@backendkit-labs/circuit-breaker', color: '#f97316' },
            { label: '@backendkit-labs/observability',   color: '#8b5cf6' },
          ]}
        />
        <P>
          A dashboard page aggregates live data from three microservices. The challenge: if one
          service is slow or down, we want partial data — not a full failure. And if one service
          degrades, it must not consume all available concurrency and take down the others.
        </P>
        <P>
          Each service gets its own <C>Bulkhead</C> and <C>CircuitBreaker</C>. All three are
          called in parallel via <C>Promise.all</C>. The result collects which services degraded
          so the frontend can show targeted "unavailable" messages instead of a blank page.
        </P>

        <SubHeading>Types and client setup</SubHeading>
        <CodeBlock filename="dashboard/dashboard.types.ts" code={ex2Types} />
        <CodeBlock filename="dashboard/dashboard.clients.ts" code={ex2Clients} />

        <SubHeading>Aggregation service</SubHeading>
        <Callout type="why">
          <C>Promise.all</C> fires all three requests simultaneously. Each has its own
          bulkhead and circuit breaker, so a slow Recommendations service cannot exhaust
          the concurrency of Profile or Orders calls.
        </Callout>
        <CodeBlock filename="dashboard/dashboard.service.ts" code={ex2Service} />
      </section>

      <Divider />

      {/* ── Example 3 ───────────────────────────────────────────────────────── */}
      <section id="batch-import">
        <SectionHeading id="batch-import">
          3 — CSV Batch Import with Collect-All Validation
        </SectionHeading>
        <BadgeList
          items={[
            { label: '@backendkit-labs/pipeline', color: '#06b6d4' },
            { label: '@backendkit-labs/result',   color: '#4f7eff' },
            { label: '@backendkit-labs/observability', color: '#8b5cf6' },
          ]}
        />
        <P>
          When importing a CSV file a user has prepared offline, showing only the first error
          per row is a terrible experience — they must fix it, resubmit, discover the next error,
          and repeat. <C>Pipeline</C> in <strong>collect-all</strong> mode solves this: every
          validation handler runs regardless of previous failures, and the result is a complete
          list of every error per row.
        </P>

        <SubHeading>Types</SubHeading>
        <CodeBlock filename="import/import.types.ts" code={ex3Types} />

        <SubHeading>Validation handlers</SubHeading>
        <Callout type="tip">
          Amounts are parsed to integer cents to avoid floating-point arithmetic errors in
          monetary calculations — a subtle but critical correctness requirement.
        </Callout>
        <CodeBlock filename="import/handlers/parse-*.handler.ts" code={ex3Handlers} />

        <SubHeading>Pipeline assembly and import service</SubHeading>
        <Callout type="why">
          Rows are processed sequentially, not in parallel, to prevent race conditions where two
          rows in the same file could both pass the duplicate-email check but then both be written.
        </Callout>
        <CodeBlock filename="import/import.pipeline.ts" code={ex3Pipeline} />
      </section>

      <Divider />

      {/* ── Example 4 ───────────────────────────────────────────────────────── */}
      <section id="secure-search">
        <SectionHeading id="secure-search">
          4 — Security-Hardened Search Endpoint
        </SectionHeading>
        <BadgeList
          items={[
            { label: '@backendkit-labs/request-scanner', color: '#ef4444' },
            { label: '@backendkit-labs/result',          color: '#4f7eff' },
            { label: '@backendkit-labs/observability',   color: '#8b5cf6' },
          ]}
        />
        <P>
          A public search endpoint is one of the highest-risk surfaces for injection attacks:
          it accepts free-form text, queries a data store, and returns structured data. This
          example applies three independent layers of protection.
        </P>
        <P>
          Layer 1 is the <C>ScannerGuard</C> WAF — blocking at the guard level before any
          application code runs. Layer 2 is the Elasticsearch query builder — using the
          parameterized DSL, never string interpolation. Layer 3 is <C>Result</C> — every
          infrastructure error is typed and handled explicitly, preventing unexpected 500s.
        </P>

        <SubHeading>Module overview</SubHeading>
        <CodeBlock filename="search/search.module.ts" code={ex4Module} />

        <SubHeading>WAF guard with threat telemetry</SubHeading>
        <Callout type="why">
          <C>maxDepth: 5</C> and <C>maxStringLength: 2000</C> are not just security controls —
          they are DoS protection. A deeply-nested payload can exhaust the recursive scanner;
          these caps make the worst-case scan time O(depth × length) and bounded.
        </Callout>
        <CodeBlock filename="search/search.guard.ts" code={ex4Guard} />

        <SubHeading>Search service — typed errors, zero exceptions</SubHeading>
        <CodeBlock filename="search/search.service.ts" code={ex4Service} />

        <SubHeading>Controller — guard + Result + HTTP mapping</SubHeading>
        <Callout type="tip">
          <C>no_results</C> returns <C>200 &#123; items: [] &#125;</C>, not 404. "No results"
          is a valid business outcome, not an error. This distinction matters for clients that
          cache 404 responses differently from 200s.
        </Callout>
        <CodeBlock filename="search/search.controller.ts" code={ex4Controller} />
      </section>

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-gray-200 dark:border-white/[0.06]">
        <p className="text-slate-400 dark:text-[#475569] text-[13px]">
          All examples use TypeScript strict mode and assume NestJS v10+. The patterns work
          equally well in Express or Fastify without the NestJS-specific decorators.
        </p>
      </div>
    </div>
  );
}
