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

// ── Example 8: Multi-provider Payment Failover ────────────────────────────────

const ex8Types = `// payment/payment.types.ts

import type { Result } from '@backendkit-labs/result';

/**
 * The error union distinguishes PERMANENT failures from infrastructure failures.
 *
 * 'all_providers_failed' — every provider had its circuit open or returned 5xx.
 *                          The caller may retry after a cooling period.
 * 'card_declined'        — the card itself rejected the charge. No point trying
 *                          other providers — they see the same card and decline too.
 * 'invalid_card'         — structurally invalid card number / expiry / CVV.
 *
 * Infrastructure failures (network, 5xx, circuit open) are NOT in this union —
 * they trigger the next provider in the failover chain, invisible to the caller.
 */
export type PaymentError =
  | { type: 'all_providers_failed'; tried: PaymentProvider[] }
  | { type: 'card_declined'; provider: PaymentProvider; code: string }
  | { type: 'invalid_card' };

export type PaymentProvider = 'stripe' | 'paypal' | 'braintree';

export interface ChargeResult {
  provider: PaymentProvider;
  transactionId: string;
  receiptUrl: string;
}

export type PaymentResult = Result<ChargeResult, PaymentError>;`;

const ex8Service = `// payment/payment.service.ts

import { Injectable } from '@nestjs/common';
import { ok, fail } from '@backendkit-labs/result';
import { CircuitBreakerRegistry } from '@backendkit-labs/circuit-breaker';
import { BulkheadRegistry } from '@backendkit-labs/bulkhead';
import type { PaymentProvider, PaymentResult } from './payment.types';

/**
 * Sequential failover across three payment providers.
 *
 * Provider ordering is deliberate:
 *   Stripe first    — best developer experience, lowest decline rates.
 *   PayPal second   — broad consumer acceptance, separate infrastructure.
 *   Braintree third — owned by PayPal but independent stack, useful when
 *                     PayPal's primary stack is degraded.
 *
 * Each provider gets its own CircuitBreaker and Bulkhead:
 *
 * CircuitBreaker — isFailure MUST return false for 4xx responses.
 *   A declined card is a business event, not an infrastructure failure.
 *   If 4xx opened the breaker, a wave of declined cards (e.g. a bot attack)
 *   would block the next legitimate customer whose card is perfectly valid.
 *
 * Bulkhead — prevents one slow provider from blocking calls to the others.
 *   If Stripe is slow, its queue fills and new calls are rejected fast —
 *   they failover to PayPal rather than waiting in Stripe's queue.
 */
@Injectable()
export class PaymentService {
  private readonly order: PaymentProvider[] = ['stripe', 'paypal', 'braintree'];
  private readonly cb = new CircuitBreakerRegistry();
  private readonly bh = new BulkheadRegistry();

  constructor(
    private readonly stripeClient: StripeHttpClient,
    private readonly paypalClient: PayPalHttpClient,
    private readonly braintreeClient: BraintreeHttpClient,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  async charge(dto: ChargeDto, correlationId: string): Promise<PaymentResult> {
    const tried: PaymentProvider[] = [];

    for (const provider of this.order) {
      const breaker = this.cb.getOrCreate(provider, {
        failureThreshold: 5,
        // 4xx = business event, not infrastructure failure — never opens the breaker
        isFailure: (err) => err.type !== 'client_error',
      });
      const bulkhead = this.bh.getForHttpExternal(provider);

      const result = await bulkhead.execute(() =>
        breaker.execute(() => this.callProvider(provider, dto)),
      );

      if (result.ok) {
        this.metrics.increment('payments.success', { provider });
        return ok(result.value);
      }

      // Permanent business failure — other providers see the same card.
      // Short-circuit: no point trying the remaining providers.
      if (result.error.type === 'card_declined' || result.error.type === 'invalid_card') {
        this.metrics.increment('payments.declined', { provider });
        return fail(result.error);
      }

      // Infrastructure failure (circuit open, 5xx, timeout) → try next provider
      tried.push(provider);
      this.logger.warn('Provider unavailable, failing over', { provider, reason: result.error.type, correlationId });
      this.metrics.increment('payments.failover', { from: provider });
    }

    this.logger.error('All payment providers failed', { tried, correlationId });
    this.metrics.increment('payments.all_failed');
    return fail({ type: 'all_providers_failed', tried });
  }

  private async callProvider(provider: PaymentProvider, dto: ChargeDto): Promise<PaymentResult> {
    const client = { stripe: this.stripeClient, paypal: this.paypalClient, braintree: this.braintreeClient }[provider];
    const r = await client.post<ProviderResponse>('/charge', dto);

    if (!r.ok) {
      if (r.error.type === 'client_error' && r.error.status === 402) {
        return fail({ type: 'card_declined', provider, code: r.error.body?.decline_code ?? 'generic' });
      }
      if (r.error.type === 'client_error' && r.error.status === 422) {
        return fail({ type: 'invalid_card' });
      }
      return fail(r.error as any);
    }

    return ok({ provider, transactionId: r.value.id, receiptUrl: r.value.receipt_url });
  }
}`;

// ── Example 9: Validation Pipeline with Early-exit ────────────────────────────

const ex9Types = `// transfer/transfer.types.ts

import type { Result } from '@backendkit-labs/result';

/**
 * TransferContext flows through each validation handler.
 * Fields are set progressively as each step succeeds.
 * 'readonly' on the input DTO prevents accidental mutation by any handler.
 */
export interface TransferContext {
  readonly dto: TransferDto;
  readonly correlationId: string;
  scanned?: true;
  sender?: Account;
  recipient?: Account;
}

/**
 * Each error type corresponds to exactly one handler.
 * The discriminated union forces every caller to handle every case.
 *
 * 'injection_detected'  — WAF blocked input before any business logic ran
 * 'sender_not_found'    — sending account does not exist
 * 'recipient_blocked'   — recipient's account is flagged or frozen
 * 'insufficient_funds'  — sender balance below the transfer amount
 */
export type TransferError =
  | { type: 'injection_detected'; category: string; ruleId: string }
  | { type: 'sender_not_found' }
  | { type: 'recipient_blocked'; reason: string }
  | { type: 'insufficient_funds'; available: number; requested: number };

export type TransferResult = Result<TransferContext, TransferError>;`;

const ex9Handlers = `// transfer/handlers/scan.handler.ts

import { PipelineHandler } from '@backendkit-labs/pipeline';
import { RequestScanner } from '@backendkit-labs/request-scanner';
import { ok, fail } from '@backendkit-labs/result';
import type { TransferContext, TransferError, TransferResult } from '../transfer.types';

/**
 * Handler 1 — WAF scan. Runs FIRST, before any database call.
 * A query built from injected input could expose other accounts' data.
 * Placing this handler first guarantees no DB query ever runs with malicious input.
 */
export class ScanHandler extends PipelineHandler<TransferContext, TransferError> {
  private readonly scanner = new RequestScanner({ level: 'strict' });

  async handle(ctx: TransferContext): Promise<TransferResult> {
    const threats = this.scanner.scan({ body: ctx.dto });

    if (threats.length > 0) {
      return fail({ type: 'injection_detected', category: threats[0].category, ruleId: threats[0].ruleId });
    }

    return ok({ ...ctx, scanned: true });
  }
}

// transfer/handlers/load-accounts.handler.ts

/**
 * Handler 2 — Load sender and recipient accounts in parallel.
 * Latency = max(senderLatency, recipientLatency), not their sum.
 * Only runs after ScanHandler passes — inputs are safe to query.
 */
export class LoadAccountsHandler extends PipelineHandler<TransferContext, TransferError> {
  constructor(private readonly accounts: AccountRepository) { super(); }

  async handle(ctx: TransferContext): Promise<TransferResult> {
    const [sender, recipient] = await Promise.all([
      this.accounts.findById(ctx.dto.senderId),
      this.accounts.findById(ctx.dto.recipientId),
    ]);

    if (!sender) return fail({ type: 'sender_not_found' });

    if (!recipient || recipient.status === 'frozen' || recipient.status === 'blocked') {
      return fail({ type: 'recipient_blocked', reason: recipient?.blockReason ?? 'Account not found' });
    }

    return ok({ ...ctx, sender, recipient });
  }
}

// transfer/handlers/check-balance.handler.ts

/**
 * Handler 3 — Verify sufficient funds. Runs LAST.
 * This is the most expensive check (real-time ledger query) and would be
 * wasted if the recipient check had already failed.
 * Pipeline's stop-on-first mode guarantees this handler never runs after
 * a ScanHandler or LoadAccountsHandler failure.
 */
export class CheckBalanceHandler extends PipelineHandler<TransferContext, TransferError> {
  constructor(private readonly ledger: LedgerService) { super(); }

  async handle(ctx: TransferContext): Promise<TransferResult> {
    const available = await this.ledger.getBalance(ctx.sender!.id);

    if (available < ctx.dto.amountCents) {
      return fail({ type: 'insufficient_funds', available, requested: ctx.dto.amountCents });
    }

    return ok(ctx);
  }
}`;

const ex9Service = `// transfer/transfer.service.ts

import { Injectable } from '@nestjs/common';
import { Pipeline } from '@backendkit-labs/pipeline';
import type { TransferContext, TransferError, TransferResult } from './transfer.types';

/**
 * Pipeline in stop-on-first mode — the order is intentional:
 *
 * 1. ScanHandler      — security check, no I/O, eliminates malicious input immediately
 * 2. LoadAccounts     — I/O but necessary before the balance check
 * 3. CheckBalance     — most expensive (real-time ledger); only runs if steps 1+2 pass
 *
 * Running cheapest-first minimises total I/O when validation fails.
 * Each handler is independently unit-testable by calling handle() with a plain object.
 */
@Injectable()
export class TransferService {
  private readonly pipeline: Pipeline<TransferContext, TransferError>;

  constructor(accounts: AccountRepository, ledger: LedgerService) {
    this.pipeline = new Pipeline<TransferContext, TransferError>({ mode: 'stop-on-first' })
      .pipe(new ScanHandler())
      .pipe(new LoadAccountsHandler(accounts))
      .pipe(new CheckBalanceHandler(ledger));
  }

  async validate(dto: TransferDto, correlationId: string): Promise<TransferResult> {
    return this.pipeline.run({ dto, correlationId });
  }
}

// transfer/transfer.controller.ts

@Controller('transfers')
export class TransferController {
  constructor(private readonly transfer: TransferService) {}

  @Post('validate')
  async validate(@Body() dto: TransferDto, @Req() req: Request) {
    const result = await this.transfer.validate(dto, req.headers['x-correlation-id'] as string);

    if (result.ok) return { valid: true };

    switch (result.error.type) {
      case 'injection_detected':  throw new ForbiddenException('Request blocked by security policy');
      case 'sender_not_found':    throw new NotFoundException('Sender account not found');
      case 'recipient_blocked':   throw new UnprocessableEntityException(result.error.reason);
      case 'insufficient_funds':  throw new UnprocessableEntityException({
                                    message: 'Insufficient funds',
                                    available: result.error.available,
                                    requested: result.error.requested,
                                  });
    }
  }
}`;

// ── Example 10: Real-time Price Aggregation ────────────────────────────────────

const ex10Types = `// pricing/pricing.types.ts

import type { Result } from '@backendkit-labs/result';

/**
 * A normalised quote from a single pricing provider.
 * Each provider returns prices in different formats and currencies —
 * all are converted to USD cents here so comparisons are straightforward.
 */
export interface PriceQuote {
  provider: string;
  amountUsd: number;
  expiresAt: Date;
  quoteId: string;
}

export type PricingError =
  | { type: 'no_providers_available' };

/**
 * The aggregated response carries the best quote AND all alternatives.
 *
 * Why return alternatives instead of just the best?
 * — The best quote may expire before the user acts. Alternatives are fallbacks.
 * — The UI can show "Best: $42.00 from Acme. Also: $44.50 from Beta (5 min)."
 * — Callers can apply their own ranking (prefer a specific provider, for example).
 */
export interface AggregatedQuote {
  best: PriceQuote;
  alternatives: PriceQuote[];
  failedProviders: string[];
}

export type QuoteResult = Result<AggregatedQuote, PricingError>;`;

const ex10Service = `// pricing/pricing.service.ts

import { Injectable } from '@nestjs/common';
import { parallel, partition, ok, fail, type Result } from '@backendkit-labs/result';
import { BulkheadRegistry } from '@backendkit-labs/bulkhead';
import type { PriceQuote, PricingError, QuoteResult } from './pricing.types';

/**
 * Queries N pricing providers simultaneously and returns the cheapest valid quote.
 *
 * Why parallel() instead of Promise.all directly?
 * — result.parallel adds a concurrency cap. If the provider list grows to 20+,
 *   we do not fire 20 simultaneous calls and hit every provider's rate limit at once.
 *
 * Why NOT use result.any (first success)?
 * — result.any races and returns the FIRST to succeed — not the CHEAPEST.
 *   Provider A may respond quickly with $60 while Provider B takes 300 ms but quotes $42.
 *   We need to wait for ALL responses (or a shared timeout) to find the best price.
 *
 * Why return alternatives alongside the best quote?
 * — Quote expiry is short (minutes). If the user delays, the best quote may expire
 *   and the client can fall back to the next alternative without a second API round-trip.
 */
@Injectable()
export class PricingService {
  private readonly bulkheads = new BulkheadRegistry();

  constructor(
    private readonly clients: Map<string, PricingHttpClient>,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  async getBestQuote(productId: string, correlationId: string): Promise<QuoteResult> {
    const providers = [...this.clients.entries()];

    // Fan out to all providers simultaneously — each in its own bulkhead
    const results = await parallel(
      providers.map(([name, client]) => () =>
        this.bulkheads
          .getForHttpExternal(name)
          .execute(() => this.fetchQuote(name, client, productId)),
      ),
      { concurrency: 10 },
    );

    const { successes, failures } = partition(results);

    if (failures.length > 0) {
      const failedNames = providers.filter((_, i) => !results[i].ok).map(([name]) => name);
      this.logger.warn('Some pricing providers unavailable', { failed: failedNames, correlationId });
      this.metrics.increment('pricing.provider_failures', { count: String(failures.length) });
    }

    if (successes.length === 0) {
      return fail({ type: 'no_providers_available' });
    }

    // Sort ascending by price — index 0 is cheapest
    const quotes = successes.map((r) => r.value).sort((a, b) => a.amountUsd - b.amountUsd);
    const failedProviders = providers.filter((_, i) => !results[i].ok).map(([name]) => name);

    return ok({ best: quotes[0], alternatives: quotes.slice(1), failedProviders });
  }

  private async fetchQuote(
    name: string,
    client: PricingHttpClient,
    productId: string,
  ): Promise<Result<PriceQuote, { type: string }>> {
    const r = await client.get<ProviderQuoteResponse>(\`/quotes/\${productId}\`);

    if (!r.ok) return fail({ type: r.error.type });

    const expiresAt = new Date(r.value.expires_at);
    if (expiresAt <= new Date()) return fail({ type: 'quote_expired' });

    return ok({
      provider:  name,
      amountUsd: Math.round(r.value.price_usd * 100) / 100,
      expiresAt,
      quoteId:   r.value.quote_id,
    });
  }
}`;

// ── Example 5: CLI Deployment Tool ───────────────────────────────────────────

const ex5Script = `// deploy.ts — npx tsx deploy.ts <app> <version>

import { AnimationManager, AnimationType } from '@backendkit-labs/console-animations';
import { HttpClient } from '@backendkit-labs/http-client';
import { retryWithBackoff, match } from '@backendkit-labs/result';

/**
 * Animation is not cosmetic here — it is the operator's feedback loop while
 * waiting for async operations (build: 30–120 s, promotion: 10–30 s).
 * Without visible feedback, a working process looks identical to a hung one.
 *
 * Each phase maps to a semantically distinct animation:
 *   SPINNER      — indeterminate wait (triggering an async job, unknown end)
 *   DOTS         — polling with unknown end time (build in progress)
 *   PROGRESS_BAR — bounded operation with a visible advancing bar
 */
const manager = new AnimationManager();
const api = new HttpClient({
  baseUrl: process.env.DEPLOY_API_URL ?? 'https://api.deploy.example.com',
  timeout: 10_000,
});

async function deploy(app: string, version: string): Promise<void> {
  console.log(\`\\nDeploying \${app}@\${version}\\n\`);

  // ── Phase 1: Trigger build ────────────────────────────────────────────────
  const buildAnim = manager.start({
    type: AnimationType.SPINNER,
    text: 'Triggering build',
    color: 'cyan',
  });

  const buildResult = await api.post<{ buildId: string }>('/builds', { app, version });
  manager.stop(buildAnim.id);

  if (!buildResult.ok) {
    console.error(\`\\n  ✗  Could not trigger build (\${buildResult.error.type})\`);
    process.exit(1);
  }

  const { buildId } = buildResult.value;

  // ── Phase 2: Poll build status ────────────────────────────────────────────
  // retryWithBackoff is used as a poller, not just for error recovery.
  // Returning non-ok when status is 'pending' triggers the next poll interval.
  // maxAttempts × maxMs bounds the worst-case wait to ~5 minutes.
  const pollAnim = manager.start({
    type: AnimationType.DOTS,
    text: \`Build \${buildId} running\`,
    color: 'yellow',
  });

  const statusResult = await retryWithBackoff(
    async () => {
      const r = await api.get<{ status: string; logs?: string }>(
        \`/builds/\${buildId}\`,
      );
      if (!r.ok)                        return r;
      if (r.value.status === 'pending') return { ok: false, error: { type: 'still_running' } };
      if (r.value.status === 'failed')  return { ok: false, error: { type: 'build_failed', logs: r.value.logs ?? '' } };
      return r; // status === 'succeeded'
    },
    { maxAttempts: 30, baseMs: 3_000, maxMs: 10_000, jitter: 'equal' },
  );

  manager.stop(pollAnim.id);

  if (!statusResult.ok) {
    const e = statusResult.error as { type: string; logs?: string };
    console.error(e.type === 'build_failed'
      ? \`\\n  ✗  Build failed:\\n\${e.logs}\`
      : '\\n  ✗  Build timed out — check the dashboard');
    manager.destroyAll();
    process.exit(1);
  }

  // ── Phase 3: Promote to production ────────────────────────────────────────
  const deployAnim = manager.start({
    type: AnimationType.PROGRESS_BAR,
    text: 'Promoting to production',
    color: 'green',
    width: 32,
  });

  const deployResult = await api.post<{ id: string; url: string }>(
    '/deployments',
    { buildId, environment: 'production' },
  );

  manager.stop(deployAnim.id);
  manager.destroyAll();

  match(deployResult, {
    ok:  (d) => console.log(\`\\n  ✓  \${app}@\${version} is live → \${d.url}\\n\`),
    err: (e) => { console.error(\`\\n  ✗  Promotion failed (\${e.type})\\n\`); process.exit(1); },
  });
}

deploy(process.argv[2] ?? 'my-api', process.argv[3] ?? '1.0.0');`;

// ── Example 6: Webhook Delivery ───────────────────────────────────────────────

const ex6Types = `// webhooks/webhook.types.ts

import type { Result } from '@backendkit-labs/result';

/**
 * WebhookError models only PERMANENT failures — states where no further retry
 * makes sense. Transient failures (network blip, 503) are absorbed internally
 * by retryWithBackoff and never surface to the caller.
 *
 * 'delivery_failed'  — exhausted all retry attempts with no success
 * 'target_rejected'  — endpoint returned 4xx; retrying would change nothing
 * 'queue_full'       — bulkhead rejected the call before the first attempt
 */
export type WebhookError =
  | { type: 'delivery_failed'; attempts: number }
  | { type: 'target_rejected'; status: number; body: unknown }
  | { type: 'queue_full' };

export interface Webhook {
  id: string;
  targetUrl: string;
  payload: Record<string, unknown>;
  correlationId: string;
}

export type WebhookResult = Result<{ deliveredAt: Date }, WebhookError>;`;

const ex6Service = `// webhooks/webhook.service.ts

import { Injectable } from '@nestjs/common';
import { retryWithBackoff, withTimeout, ok, fail } from '@backendkit-labs/result';
import { Bulkhead, BulkheadRegistry } from '@backendkit-labs/bulkhead';
import type { Webhook, WebhookResult } from './webhook.types';

/**
 * Three reliability layers, each solving a different failure scenario:
 *
 * Bulkhead (outer)
 *   — Caps concurrent delivery sequences. A backlog of 10,000 pending webhooks
 *     must not spawn 10,000 simultaneous HTTP connections when processing restarts.
 *     One slot per webhook for the full retry lifetime, not per individual attempt.
 *
 * withTimeout (per attempt)
 *   — Bounds a single HTTP call to 8 s. A hanging connection does not hold a
 *     bulkhead slot for the entire retry window (potentially minutes).
 *
 * retryWithBackoff with full jitter (core)
 *   — If 1,000 webhooks all fail at the same moment, their retries must NOT
 *     fire simultaneously — that would reproduce the original overload.
 *     Full jitter spreads retry times across a random window [0, baseMs × 2^n].
 */
@Injectable()
export class WebhookDeliveryService {
  private readonly bulkhead: Bulkhead;

  constructor(
    private readonly http: WebhookHttpClient,
    private readonly db: WebhookRepository,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {
    this.bulkhead = new BulkheadRegistry().getOrCreate('webhook-delivery', {
      maxConcurrentCalls: 20,
      maxQueueSize: 200,
      queueTimeoutMs: 5_000,
    });
  }

  async deliver(webhook: Webhook): Promise<WebhookResult> {
    // One bulkhead slot per delivery sequence — not per attempt.
    // 20 concurrent sequences, each possibly retrying 5 times internally.
    const result = await this.bulkhead.execute(() => this.deliverWithRetry(webhook));

    if (!result.ok && result.error.type === 'queue_full') {
      this.logger.warn('Webhook delivery queue saturated', { webhookId: webhook.id });
      this.metrics.increment('webhooks.queue_full');
    }

    return result as WebhookResult;
  }

  private async deliverWithRetry(webhook: Webhook): Promise<WebhookResult> {
    const attempt = () =>
      withTimeout(
        () => this.http.post(webhook.targetUrl, webhook.payload),
        { ms: 8_000 },
      );

    const result = await retryWithBackoff(attempt, {
      maxAttempts: 5,
      baseMs: 500,
      maxMs: 30_000,
      jitter: 'full',
      // 4xx = the target explicitly rejected the payload — retrying won't help.
      // Only retry network errors, timeouts, and 5xx responses.
      shouldRetry: (err) => err.type !== 'client_error',
      onRetry: (attempt, err) => {
        this.logger.debug('Webhook retry', { webhookId: webhook.id, attempt, reason: err.type });
        this.metrics.increment('webhooks.retried', { attempt: String(attempt) });
      },
    });

    if (!result.ok) {
      await this.db.markFailed(webhook.id);
      this.metrics.increment('webhooks.failed');
      if (result.error.type === 'client_error') {
        return fail({ type: 'target_rejected', status: result.error.status, body: result.error.body });
      }
      return fail({ type: 'delivery_failed', attempts: 5 });
    }

    const deliveredAt = new Date();
    await this.db.markDelivered(webhook.id, deliveredAt);
    this.metrics.increment('webhooks.delivered');
    return ok({ deliveredAt });
  }
}`;

// ── Example 7: Batch Enrichment ───────────────────────────────────────────────

const ex7Types = `// enrichment/enrichment.types.ts

import type { Result } from '@backendkit-labs/result';

/**
 * Each order is enriched with two data points fetched from separate APIs:
 *   UserProfile — determines the user's tier and billing region.
 *   FX rate     — converts the order amount from its currency to USD.
 *
 * Both are fetched in parallel per order via Promise.all.
 * The number of concurrently enriched orders is bounded by result.parallel.
 *
 * Concurrency math:
 *   parallel concurrency (10) × sub-requests per order (2) = max 20 simultaneous
 *   external calls. Both numbers are visible and adjustable in one place.
 */
export interface EnrichedOrder {
  orderId: string;
  userId: string;
  amountUsd: number;
  userTier: 'standard' | 'premium' | 'enterprise';
  userRegion: string;
}

export type EnrichmentError =
  | { type: 'profile_not_found'; userId: string }
  | { type: 'exchange_rate_unavailable'; currency: string }
  | { type: 'enrichment_timeout' };

export interface EnrichmentReport {
  enriched: EnrichedOrder[];
  failed: Array<{ orderId: string; error: EnrichmentError }>;
  durationMs: number;
}`;

const ex7Service = `// enrichment/enrichment.service.ts

import { Injectable } from '@nestjs/common';
import { parallel, partition, track, ok, fail } from '@backendkit-labs/result';
import { BulkheadRegistry } from '@backendkit-labs/bulkhead';
import type { Order, EnrichedOrder, EnrichmentError, EnrichmentReport } from './enrichment.types';

/**
 * Three concurrency controls compose to make this safe at scale:
 *
 * result.parallel(tasks, { concurrency: 10 })
 *   — Fans out across all orders but keeps at most 10 in-flight at once.
 *     1,000 orders do not trigger 2,000 simultaneous API calls.
 *
 * profileBulkhead / fxBulkhead (independent bulkheads)
 *   — If the Profile API slows down, its bulkhead queue fills and rejects
 *     excess calls — but the FX Rate bulkhead is completely unaffected.
 *     Two slow services cannot compound each other's latency.
 *
 * result.partition({ successes, failures })
 *   — Splits Result[] into typed arrays in one call. No filter().map() chains,
 *     no loss of the error type on the failures side.
 */
@Injectable()
export class OrderEnrichmentService {
  private readonly profileBulkhead = new BulkheadRegistry().getForHttpExternal('user-profile-api');
  private readonly fxBulkhead      = new BulkheadRegistry().getForHttpExternal('fx-rate-api');

  constructor(
    private readonly profileClient: UserProfileHttpClient,
    private readonly fxClient: FxRateHttpClient,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  async enrichBatch(orders: Order[]): Promise<EnrichmentReport> {
    const start = Date.now();

    const results = await parallel(
      orders.map((order) => () => this.enrichOne(order)),
      { concurrency: 10 },
    );

    // partition() returns { successes: Result<EnrichedOrder>[], failures: Result<_, EnrichmentError>[] }
    // Both arrays carry the full Result type — no casting needed.
    const { successes, failures } = partition(results);

    if (failures.length > 0) {
      this.logger.warn('Batch enrichment partial failure', {
        total: orders.length,
        succeeded: successes.length,
        failed: failures.length,
        errorTypes: [...new Set(failures.map((f) => f.error.type))],
      });
      this.metrics.histogram('enrichment.failure_rate', failures.length / orders.length);
    }

    return {
      enriched:   successes.map((r) => r.value),
      failed:     failures.map((f) => ({ orderId: (f.context as Order).id, error: f.error })),
      durationMs: Date.now() - start,
    };
  }

  private async enrichOne(order: Order): Promise<Result<EnrichedOrder, EnrichmentError>> {
    // track() records per-order duration and an OTel span automatically.
    // No manual Date.now() at the start + metrics call at every return path.
    // Three return paths = three places to forget — track() makes it impossible to miss.
    return track(
      async () => {
        // Both APIs fire simultaneously — enrichment latency is
        // max(profileLatency, fxLatency), not their sum.
        const [profileResult, fxResult] = await Promise.all([
          this.profileBulkhead.execute(() =>
            this.profileClient.get<UserProfile>(\`/users/\${order.userId}\`),
          ),
          this.fxBulkhead.execute(() =>
            this.fxClient.get<FxRate>(\`/rates/\${order.currency}/USD\`),
          ),
        ]);

        if (!profileResult.ok) {
          return profileResult.error.type === 'not_found'
            ? fail({ type: 'profile_not_found', userId: order.userId })
            : fail({ type: 'enrichment_timeout' });
        }

        if (!fxResult.ok) {
          return fail({ type: 'exchange_rate_unavailable', currency: order.currency });
        }

        return ok({
          orderId:    order.id,
          userId:     order.userId,
          amountUsd:  Math.round(order.amountCents * fxResult.value.rate) / 100,
          userTier:   profileResult.value.tier,
          userRegion: profileResult.value.region,
        });
      },
      {
        operation:     'order.enrich',
        correlationId: order.correlationId,
        tags:          { orderId: order.id, currency: order.currency },
      },
    );
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

      <Divider />

      {/* ── Example 5 ───────────────────────────────────────────────────────── */}
      <section id="cli-deploy">
        <SectionHeading id="cli-deploy">
          5 — CLI Deployment Tool
        </SectionHeading>
        <BadgeList
          items={[
            { label: '@backendkit-labs/console-animations', color: '#ec4899' },
            { label: '@backendkit-labs/http-client',        color: '#f59e0b' },
            { label: '@backendkit-labs/result',             color: '#4f7eff' },
          ]}
        />
        <P>
          A CLI tool that deploys an application through a remote build-and-promote API.
          The challenge: each phase takes 30–120 seconds and the operator needs continuous
          visual feedback to distinguish a working process from a hung one.
        </P>
        <P>
          Each phase maps to a semantically correct animation: <C>SPINNER</C> for a
          one-shot async trigger, <C>DOTS</C> for open-ended polling, and <C>PROGRESS_BAR</C> for
          a bounded promotion step. <C>retryWithBackoff</C> doubles as a polling primitive —
          returning non-ok when build status is <C>'pending'</C> triggers the next interval
          without a custom polling loop.
        </P>

        <SubHeading>Runnable script</SubHeading>
        <Callout type="why">
          <C>retryWithBackoff</C> is used as a poller here, not just for error recovery.
          The build status endpoint returns <C>'pending'</C> while the build runs — mapping
          that to a non-ok result instructs the retry engine to wait and poll again,
          reusing the backoff logic without writing a custom interval loop.
        </Callout>
        <CodeBlock filename="deploy.ts" comment="npx tsx deploy.ts my-api 2.4.1" code={ex5Script} />
      </section>

      <Divider />

      {/* ── Example 6 ───────────────────────────────────────────────────────── */}
      <section id="webhook-delivery">
        <SectionHeading id="webhook-delivery">
          6 — Webhook Delivery with Retry and Backoff
        </SectionHeading>
        <BadgeList
          items={[
            { label: '@backendkit-labs/result',       color: '#4f7eff' },
            { label: '@backendkit-labs/bulkhead',     color: '#10b981' },
            { label: '@backendkit-labs/observability', color: '#8b5cf6' },
          ]}
        />
        <P>
          Reliable webhook delivery requires handling three distinct failure scenarios with
          different responses: transient errors (network blips, 503s) should be retried;
          permanent rejections (4xx) should not; overload (too many pending deliveries)
          should fail fast rather than queue indefinitely.
        </P>
        <P>
          <C>retryWithBackoff</C> with full jitter absorbs transients without producing
          synchronized retry storms. <C>withTimeout</C> bounds each individual HTTP
          attempt so a hanging connection does not hold a <C>Bulkhead</C> slot for the
          full retry window. The bulkhead limits concurrent delivery sequences — not
          individual HTTP calls — so one slot covers all five attempts of a single webhook.
        </P>

        <SubHeading>Types</SubHeading>
        <Callout type="why">
          The error union models only permanent failures. Transient errors are absorbed by
          <C>retryWithBackoff</C> and never surface to the caller — the union stays minimal
          and every case in a downstream switch is load-bearing with no dead branches.
        </Callout>
        <CodeBlock filename="webhooks/webhook.types.ts" code={ex6Types} />

        <SubHeading>Delivery service</SubHeading>
        <Callout type="tip">
          Full jitter (<C>jitter: 'full'</C>) randomises each wait in{' '}
          <C>[0, baseMs × 2^attempt]</C>. Equal jitter spreads half the range.
          Full jitter is the right choice when many callers can fail simultaneously —
          it prevents the synchronized retry wave that would reproduce the original overload.
        </Callout>
        <CodeBlock filename="webhooks/webhook.service.ts" code={ex6Service} />
      </section>

      <Divider />

      {/* ── Example 7 ───────────────────────────────────────────────────────── */}
      <section id="batch-enrichment">
        <SectionHeading id="batch-enrichment">
          7 — Batch Order Enrichment with Controlled Concurrency
        </SectionHeading>
        <BadgeList
          items={[
            { label: '@backendkit-labs/result',       color: '#4f7eff' },
            { label: '@backendkit-labs/bulkhead',     color: '#10b981' },
            { label: '@backendkit-labs/observability', color: '#8b5cf6' },
          ]}
        />
        <P>
          Enriching a batch of orders with external API data is a two-dimensional
          concurrency problem: how many orders to process simultaneously, and how many
          requests to send to each upstream service. Both need independent controls —
          a slow Profile API must not starve the FX Rate API.
        </P>
        <P>
          <C>parallel()</C> fans out the batch with a configurable cap. Inside each order,
          both APIs are called via <C>Promise.all</C> for minimum latency. Independent
          bulkheads isolate the two upstreams from each other. <C>partition()</C> splits
          the final <C>Result[]</C> into typed success and failure arrays in one call —
          no filter/map chains, no loss of the error type.
        </P>

        <SubHeading>Types</SubHeading>
        <Callout type="info">
          Concurrency math: <C>parallel</C> concurrency of 10 × 2 sub-requests per order
          = worst-case 20 simultaneous external calls. Both numbers are in one place —
          no need to audit <C>Promise.all</C> chains spread across the codebase to
          understand the load profile.
        </Callout>
        <CodeBlock filename="enrichment/enrichment.types.ts" code={ex7Types} />

        <SubHeading>Enrichment service</SubHeading>
        <Callout type="why">
          <C>track()</C> records per-order duration and an OTel span automatically.
          Without it, you need <C>Date.now()</C> at the start and a metrics call at
          every return path — three return paths means three places to forget.
          <C>track()</C> makes it structurally impossible to miss an observation point.
        </Callout>
        <CodeBlock filename="enrichment/enrichment.service.ts" code={ex7Service} />
      </section>

      <Divider />

      {/* ── Example 8 ───────────────────────────────────────────────────────── */}
      <section id="multi-provider-failover">
        <SectionHeading id="multi-provider-failover">
          8 — Multi-provider Payment Failover
        </SectionHeading>
        <BadgeList
          items={[
            { label: '@backendkit-labs/circuit-breaker', color: '#f97316' },
            { label: '@backendkit-labs/bulkhead',        color: '#10b981' },
            { label: '@backendkit-labs/http-client',     color: '#f59e0b' },
            { label: '@backendkit-labs/result',          color: '#4f7eff' },
          ]}
        />
        <P>
          Charging a card through a single provider is a single point of failure. This example
          implements sequential failover across Stripe → PayPal → Braintree, where infrastructure
          failures (circuit open, 5xx, timeout) silently move to the next provider, while permanent
          business failures (card declined, invalid card) short-circuit immediately — no other
          provider would succeed with the same card.
        </P>
        <P>
          Each provider has its own <C>CircuitBreaker</C> and <C>Bulkhead</C>. The critical detail:
          the circuit breaker's <C>isFailure</C> must return <C>false</C> for 4xx responses — a
          wave of declined cards must not open the breaker and block the next legitimate customer.
        </P>

        <SubHeading>Types</SubHeading>
        <Callout type="why">
          Infrastructure failures are absent from the error union — they trigger the next
          provider and never surface to the caller. The union stays minimal: every case a caller
          switches on is truly load-bearing.
        </Callout>
        <CodeBlock filename="payment/payment.types.ts" code={ex8Types} />

        <SubHeading>Payment service</SubHeading>
        <Callout type="tip">
          The bulkhead here prevents a slow provider from blocking calls to the others. If
          Stripe is slow and its queue fills, new calls are rejected fast and fail over to PayPal
          — rather than waiting in Stripe's queue while PayPal sits idle.
        </Callout>
        <CodeBlock filename="payment/payment.service.ts" code={ex8Service} />
      </section>

      <Divider />

      {/* ── Example 9 ───────────────────────────────────────────────────────── */}
      <section id="validation-pipeline">
        <SectionHeading id="validation-pipeline">
          9 — Validation Pipeline with Early-exit
        </SectionHeading>
        <BadgeList
          items={[
            { label: '@backendkit-labs/pipeline',        color: '#06b6d4' },
            { label: '@backendkit-labs/request-scanner', color: '#ef4444' },
            { label: '@backendkit-labs/result',          color: '#4f7eff' },
          ]}
        />
        <P>
          Validating a transfer request requires multiple sequential checks where order matters:
          a security scan must run before any database query (to avoid querying with injected
          input), account loads must succeed before the balance check (no point querying
          the ledger for a non-existent account), and the balance check is the most expensive so
          it runs last.
        </P>
        <P>
          <C>Pipeline</C> in <C>stop-on-first</C> mode models this exactly: each step has a
          specific error type in the union, the pipeline aborts on the first failure, and the
          controller maps the union to HTTP without any try/catch. <C>RequestScanner</C> is
          embedded as the first handler — not as a guard — so it shares the same typed Result
          and error union as the business logic.
        </P>

        <SubHeading>Types</SubHeading>
        <Callout type="why">
          Placing <C>RequestScanner</C> as a pipeline handler (not a NestJS guard) means the
          injection detection error is part of the same discriminated union as the business errors.
          The controller has one switch for all failure cases — no separate guard error path.
        </Callout>
        <CodeBlock filename="transfer/transfer.types.ts" code={ex9Types} />

        <SubHeading>Handlers</SubHeading>
        <Callout type="tip">
          Handler ordering is cheapest-first: the WAF scan has no I/O, account loads are
          parallelised, and the ledger query (most expensive, real-time) only runs if both
          earlier steps pass.
        </Callout>
        <CodeBlock filename="transfer/handlers/*.handler.ts" code={ex9Handlers} />

        <SubHeading>Service and controller</SubHeading>
        <CodeBlock filename="transfer/transfer.service.ts" code={ex9Service} />
      </section>

      <Divider />

      {/* ── Example 10 ──────────────────────────────────────────────────────── */}
      <section id="price-aggregation">
        <SectionHeading id="price-aggregation">
          10 — Real-time Price Aggregation
        </SectionHeading>
        <BadgeList
          items={[
            { label: '@backendkit-labs/result',   color: '#4f7eff' },
            { label: '@backendkit-labs/bulkhead', color: '#10b981' },
            { label: '@backendkit-labs/observability', color: '#8b5cf6' },
          ]}
        />
        <P>
          Fetching the best price for a product requires querying multiple providers simultaneously
          and comparing their responses — you cannot use the first response that arrives because a
          fast provider is not necessarily the cheapest. All must be collected, then sorted.
        </P>
        <P>
          <C>parallel()</C> fans out with a concurrency cap so a large provider list does not
          fire unbound simultaneous calls. <C>partition()</C> separates usable quotes from
          unavailable providers in one call. The result returns both the best quote AND the
          alternatives so the client can fall back without a second round-trip if the best
          quote expires before the user acts.
        </P>

        <SubHeading>Types</SubHeading>
        <Callout type="why">
          Returning <C>alternatives[]</C> alongside <C>best</C> is a deliberate API decision.
          Quotes expire in minutes. If the client makes a second request after expiry, it re-pays
          the latency cost of querying every provider again. Alternatives amortise that cost.
        </Callout>
        <CodeBlock filename="pricing/pricing.types.ts" code={ex10Types} />

        <SubHeading>Aggregation service</SubHeading>
        <Callout type="tip">
          This example uses <C>parallel</C> + <C>partition</C> rather than <C>result.any</C>.
          <C>any</C> races and returns the first success — fast but not cheapest.
          Here we wait for all responses, then sort: correctness over raw speed.
        </Callout>
        <CodeBlock filename="pricing/pricing.service.ts" code={ex10Service} />
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
