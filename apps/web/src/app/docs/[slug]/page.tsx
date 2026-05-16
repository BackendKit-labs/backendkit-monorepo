import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { packageDocs } from '@/lib/package-docs';
import { highlight } from '@/lib/highlight';
import { ExamplesTabs, type DocExample } from '@/components/docs/examples-tabs';
import PackageIcon from '@/components/package-icon';

export function generateStaticParams() {
  return packageDocs.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pkg = packageDocs.find((p) => p.slug === slug);
  if (!pkg) return {};
  return {
    title: `${pkg.npmName} — BackendKit Labs Docs`,
    description: pkg.description,
  };
}

// ── Shared UI components ─────────────────────────────────────────────────────

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-[22px] font-bold text-gray-900 dark:text-white mt-12 mb-4 scroll-mt-20 flex items-center gap-2 group tracking-tight">
      {children}
      <a href={`#${id}`} className="opacity-0 group-hover:opacity-40 text-slate-400 dark:text-[#64748b] transition-opacity text-sm font-normal">#</a>
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

function CodeBlock({ code, filename }: { code: string; filename?: string }) {
  const html = highlight(code);
  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#0d1117] my-5">
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
  );
}

function PropsTable({ rows }: {
  rows: { prop: string; type: string; default?: string; description: string }[];
}) {
  return (
    <div className="my-5 rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.06]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/[0.06]">
            <th className="text-left px-4 py-2.5 font-mono text-[11px] text-slate-500 dark:text-[#64748b] font-semibold uppercase tracking-wide">Prop</th>
            <th className="text-left px-4 py-2.5 font-mono text-[11px] text-slate-500 dark:text-[#64748b] font-semibold uppercase tracking-wide">Type</th>
            <th className="text-left px-4 py-2.5 font-mono text-[11px] text-slate-500 dark:text-[#64748b] font-semibold uppercase tracking-wide hidden sm:table-cell">Default</th>
            <th className="text-left px-4 py-2.5 font-mono text-[11px] text-slate-500 dark:text-[#64748b] font-semibold uppercase tracking-wide">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.prop} className={`border-b border-gray-100 dark:border-white/[0.04] last:border-b-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-white/[0.01]'}`}>
              <td className="px-4 py-2.5 font-mono text-[12px] text-blue-700 dark:text-[#79c0ff] whitespace-nowrap">{row.prop}</td>
              <td className="px-4 py-2.5 font-mono text-[12px] text-blue-600 dark:text-[#a5d6ff] whitespace-nowrap">{row.type}</td>
              <td className="px-4 py-2.5 font-mono text-[12px] text-slate-400 dark:text-[#64748b] hidden sm:table-cell">{row.default ?? '—'}</td>
              <td className="px-4 py-2.5 text-[14px] text-slate-600 dark:text-[#94a3b8]">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ComparisonRow {
  feature: string;
  ours: string;
  alt1: string;
  alt2?: string;
}

function ComparisonTable({
  ours,
  alternatives,
  rows,
  intro,
}: {
  ours: string;
  alternatives: string[];
  rows: ComparisonRow[];
  intro: string;
}) {
  const cell = (v: string) => {
    if (v === '✅') return <span className="text-[#28c840] text-base">✅</span>;
    if (v === '❌') return <span className="text-[#ef4444] text-base">❌</span>;
    if (v === '⚠️') return <span className="text-[#f97316] text-base">⚠️</span>;
    return <span className="text-slate-600 dark:text-[#94a3b8] text-[13px]">{v}</span>;
  };

  return (
    <div className="my-6">
      <p className="text-slate-600 dark:text-[#94a3b8] text-[15px] leading-relaxed mb-4">{intro}</p>
      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.06]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/[0.06]">
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 dark:text-[#64748b] font-semibold uppercase tracking-wide min-w-[180px]">
                  Feature
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[#4f7eff] min-w-[160px]">
                  {ours}
                </th>
                {alternatives.map((a) => (
                  <th key={a} className="text-left px-4 py-3 text-[11px] text-slate-500 dark:text-[#64748b] font-semibold uppercase tracking-wide min-w-[140px]">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.feature} className={`border-b border-gray-100 dark:border-white/[0.04] last:border-b-0 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-white/[0.01]'}`}>
                  <td className="px-4 py-3 text-[14px] text-gray-800 dark:text-[#e2e8f0] font-medium">{row.feature}</td>
                  <td className="px-4 py-3">{cell(row.ours)}</td>
                  <td className="px-4 py-3">{cell(row.alt1)}</td>
                  {row.alt2 !== undefined && <td className="px-4 py-3">{cell(row.alt2)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Per-package doc content ──────────────────────────────────────────────────

interface DocPageData {
  content: React.FC<{ color: string }>;
  examples: DocExample[];
}

const docPages: Record<string, DocPageData> = {

  result: {
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
  console.log(result.value.name);   // TypeScript knows: User
} else {
  console.error(result.error.type); // TypeScript knows: 'not_found'
}`,
      },
      {
        label: 'Intermediate',
        filename: 'order.service.ts',
        code: `import { ok, fail, map, flatMap } from '@backendkit-labs/result';

// Chain operations — each step is fully type-safe
async function processOrder(
  id: string,
): Promise<Result<Invoice, OrderError | UserError | InvoiceError>> {
  const order = await getOrder(id);                 // Result<Order, OrderError>
  const user  = await flatMap(order, getUser);      // Result<User, ... | UserError>
  const inv   = await flatMap(user, createInvoice); // Result<Invoice, ... | InvoiceError>
  return inv;
}

// Inline transform — changes success type, errors pass through unchanged
const totalPrice = await getOrder('ord_1').then(r =>
  map(r, o => o.items.reduce((sum, item) => sum + item.price, 0)),
); // Result<number, OrderError>`,
      },
      {
        label: 'Advanced',
        filename: 'checkout.service.ts',
        code: `import { ok, fail, flatMap, type Result } from '@backendkit-labs/result';

// Multiple error types compose automatically in the union
type UserError   = NotFoundError | PermissionError;
type OrderError  = ValidationError | PaymentError;

async function checkout(
  userId: string,
  items: CartItem[],
): Promise<Result<Receipt, UserError | OrderError>> {
  const user    = await getUser(userId);
  const order   = await flatMap(user, u => createOrder(u, items));
  const payment = await flatMap(order, processPayment);
  const receipt = await flatMap(payment, sendConfirmation);
  return receipt;
}

// The caller handles one discriminated union — no try/catch anywhere
const receipt = await checkout('usr_123', cartItems);
if (!receipt.ok) {
  switch (receipt.error.type) {
    case 'not_found':      return res.status(404).json(receipt.error);
    case 'payment_failed': return res.status(402).json(receipt.error);
    default:               return res.status(400).json(receipt.error);
  }
}`,
      },
    ],
    content: function ResultContent({ color }) {
      return (
        <>
          <section id="overview">
            <SectionHeading id="overview">Overview</SectionHeading>
            <P>
              Node.js error handling traditionally relies on <C>throw</C> and <C>try/catch</C> — an
              approach with three deep problems: the flow becomes non-local (a function can throw from
              any point), TypeScript cannot express what a function might throw so callers must read
              source code, and a forgotten <C>catch</C> lets exceptions propagate silently to the
              top of the stack.
            </P>
            <P>
              <C>Result&lt;T, E&gt;</C> implements the <strong>Result Monad</strong> (also called
              Either): a function that can fail returns an object that explicitly and precisely
              represents either a success (<C>Ok&lt;T&gt;</C>) or a typed failure (<C>Fail&lt;E&gt;</C>).
              The compiler forces callers to handle both paths. Errors show up in function signatures,
              compose with <C>map</C> / <C>flatMap</C>, and TypeScript narrows them automatically
              inside if-blocks — no casting required.
            </P>
            <P>
              <strong>This package is the semantic base of the entire BackendKit suite.</strong> By
              unifying error handling into a single data type, every other library (http-client,
              pipeline, circuit-breaker) can communicate without friction and offer a coherent
              developer experience.
            </P>
          </section>

          <section id="quickstart">
            <SectionHeading id="quickstart">Quick Start</SectionHeading>
            <CodeBlock code="npm install @backendkit-labs/result" />
            <CodeBlock
              filename="user.service.ts"
              code={`import { ok, fail, type Result } from '@backendkit-labs/result';

async function getUser(id: string): Promise<Result<User, NotFoundError>> {
  const user = await db.users.findById(id);
  if (!user) return fail({ type: 'not_found', id });
  return ok(user);
}

const result = await getUser('usr_123');
if (result.ok) {
  console.log(result.value.name); // User — TypeScript knows
} else {
  handleError(result.error);      // NotFoundError — TypeScript knows
}`}
            />
          </section>

          <section id="core">
            <SectionHeading id="core">Core Concepts</SectionHeading>
            <SubHeading>ok() and fail()</SubHeading>
            <P>
              <C>ok(value)</C> wraps any value into a successful result.{' '}
              <C>fail(error)</C> wraps any object into a typed failure. Both return a{' '}
              <C>Result&lt;T, E&gt;</C>.
            </P>
            <SubHeading>map and flatMap</SubHeading>
            <P>
              <C>map(r, fn)</C> transforms the success value if the result is ok, passing the
              error through unchanged. <C>flatMap(r, fn)</C> is the same but{' '}
              <C>fn</C> itself returns a <C>Result</C> — the nesting is automatically flattened.
              Each step adds its error type to a discriminated union; the caller handles one{' '}
              <C>switch</C> instead of multiple <C>catch</C> blocks.
            </P>
            <CodeBlock
              filename="compose.ts"
              code={`const name = await getUser('u1').then(r =>
  map(r, user => user.name.toUpperCase()),
); // Result<string, NotFoundError>

const invoice = await getUser('u1').then(r =>
  flatMap(r, user => createInvoice(user)),
); // Result<Invoice, NotFoundError | InvoiceError>`}
            />
            <SubHeading>andThen and orElse</SubHeading>
            <P>
              <C>andThen</C> is an alias for <C>flatMap</C> — preferred when chaining inline.{' '}
              <C>orElse(r, fn)</C> is the mirror image: it runs <C>fn</C> only when the result is a
              failure, allowing you to recover or remap errors without unwrapping success values.
            </P>
            <SubHeading>run() — safe exception boundary</SubHeading>
            <P>
              Wraps a function that may throw (third-party code, JSON.parse, etc.) and converts any
              thrown exception into a typed <C>Fail</C>. Use it at integration boundaries to keep
              your internal code exception-free.
            </P>
            <CodeBlock
              filename="safe-parse.ts"
              code={`import { run } from '@backendkit-labs/result';

// JSON.parse throws — run() catches it and returns Result
const result = run(() => JSON.parse(rawInput), (err) => ({
  type: 'parse_error' as const,
  message: String(err),
}));
// Result<unknown, { type: 'parse_error'; message: string }>`}
            />
            <SubHeading>match() — declarative handling</SubHeading>
            <P>
              Instead of an <C>if/else</C>, <C>match()</C> accepts an object with <C>ok</C> and{' '}
              <C>err</C> handlers and returns whichever branch applies. Useful when mapping a Result
              to a response shape without branching logic.
            </P>
            <CodeBlock
              filename="controller.ts"
              code={`import { match } from '@backendkit-labs/result';

return match(result, {
  ok:  (user)  => res.json(user),
  err: (error) => res.status(404).json({ error: error.type }),
});`}
            />
          </section>

          <section id="api">
            <SectionHeading id="api">API Reference</SectionHeading>
            <PropsTable
              rows={[
                { prop: 'ok(value)', type: 'Ok<T>', description: 'Wraps a successful value.' },
                { prop: 'fail(error)', type: 'Fail<E>', description: 'Wraps a typed failure.' },
                { prop: 'map(r, fn)', type: 'Result<U, E>', description: 'Transforms the success value; passes error through unchanged.' },
                { prop: 'flatMap(r, fn)', type: 'Result<U, E|F>', description: 'Like map but fn returns a Result — nesting is flattened.' },
                { prop: 'andThen(r, fn)', type: 'Result<U, E|F>', description: 'Alias for flatMap — preferred for inline chaining.' },
                { prop: 'orElse(r, fn)', type: 'Result<T, F>', description: 'Mirror of flatMap: fn runs only on failure, allowing recovery or error remapping.' },
                { prop: 'mapError(r, fn)', type: 'Result<T, F>', description: 'Transforms the error value; success passes through unchanged.' },
                { prop: 'run(fn, mapErr)', type: 'Result<T, E>', description: 'Catches exceptions from fn and converts them to a typed Fail via mapErr.' },
                { prop: 'match(r, { ok, err })', type: 'U', description: 'Declarative branching: calls the matching handler and returns its value.' },
                { prop: 'isOk(r)', type: 'boolean', description: 'Type guard: narrows r to Ok<T>.' },
                { prop: 'isFail(r)', type: 'boolean', description: 'Type guard: narrows r to Fail<E>.' },
              ]}
            />
          </section>
        </>
      );
    },
  },

  'circuit-breaker': {
    examples: [
      {
        label: 'Basic',
        filename: 'stripe.service.ts',
        code: `import { CircuitBreaker } from '@backendkit-labs/circuit-breaker';

const cb = new CircuitBreaker({
  name: 'stripe',
  failureThreshold: 40,  // open after 40 % failure rate
  sampleSize: 20,        // over the last 20 calls
  cooldownMs: 30_000,    // wait 30 s before probing again
});

const result = await cb.execute(() => stripe.charges.create(dto));

if (result.ok) {
  return result.value;
} else if (result.error.type === 'circuit_open') {
  throw new ServiceUnavailableException('Payment service down');
}`,
      },
      {
        label: 'Intermediate',
        filename: 'stripe.service.ts',
        code: `const cb = new CircuitBreaker({
  name: 'stripe',
  failureThreshold: 40,
  sampleSize: 20,
  cooldownMs: 30_000,
  // Business errors do NOT count against the breaker
  isBusinessError: (err) => {
    const biz = ['card_declined', 'insufficient_funds', 'invalid_card'];
    return biz.includes(err.code);
  },
});

const result = await cb.execute(() => stripe.charges.create(dto));`,
      },
      {
        label: 'Advanced',
        filename: 'payment-cb.ts',
        code: `const cb = new CircuitBreaker({
  name: 'payment-gateway',
  failureThreshold: 30,
  sampleSize: 50,
  cooldownMs: 60_000,
  isBusinessError: (err) => ['card_declined', 'insufficient_funds'].includes(err.code),
  onStateChange: (prev, next, metrics) => {
    logger.warn('Circuit breaker state changed', {
      from: prev, to: next,
      failureRate: metrics.failureRate,
      totalCalls: metrics.totalCalls,
    });
    if (next === 'open') {
      alerting.trigger('circuit_opened', { name: 'payment-gateway' });
    }
  },
});

// Check state without executing
if (cb.state === 'open') {
  return fail({ type: 'circuit_open', name: cb.name });
}

const result = await cb.execute(() => gateway.charge(dto));
const { failureRate, totalCalls } = cb.getMetrics();`,
      },
    ],
    content: function CircuitBreakerContent({ color }) {
      return (
        <>
          <section id="overview">
            <SectionHeading id="overview">Overview</SectionHeading>
            <P>
              The circuit breaker pattern prevents cascading failures: when a downstream service
              starts failing repeatedly, the breaker <em>opens</em> — subsequent calls short-circuit
              immediately without hitting the service — then after a cooldown it enters a{' '}
              <em>half-open</em> state to probe recovery.
            </P>
            <P>
              The critical differentiator is <strong>error classification</strong>. Traditional
              implementations (like <C>opossum</C>) treat all errors equally. In practice a{' '}
              <C>card_declined</C> from Stripe is a <em>business error</em> — the service worked
              correctly — while a connection timeout is an <em>infrastructure failure</em>. The{' '}
              <C>isFailure</C> callback lets you tell them apart: only infra failures count against
              the breaker, preventing phantom opens caused by expected business rejections.
            </P>
            <P>
              Failure rate is measured over a configurable <strong>sliding window</strong> of recent
              calls (not a fixed time interval), giving a more accurate picture of current health.
              Built-in <strong>retry with exponential backoff + jitter</strong> is available for
              transient errors before the breaker is involved.
            </P>
          </section>

          <section id="states">
            <SectionHeading id="states">States & Lifecycle</SectionHeading>
            <div className="grid sm:grid-cols-3 gap-4 my-5">
              {[
                { name: 'Closed',    color: '#28c840', desc: 'Normal operation. All calls go through. Failure rate is tracked in the sliding window.' },
                { name: 'Open',      color: '#ef4444', desc: 'Failure threshold exceeded. Calls return circuit_open immediately without hitting downstream.' },
                { name: 'Half-Open', color: '#f97316', desc: 'Cooldown elapsed. One probe call is allowed. Success → Closed, failure → Open again.' },
              ].map((s) => (
                <div key={s.name} className="rounded-xl p-4 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{s.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#94a3b8] leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="config">
            <SectionHeading id="config">Configuration</SectionHeading>
            <PropsTable
              rows={[
                { prop: 'name', type: 'string', description: 'Unique identifier used in logs and metrics.' },
                { prop: 'failureThreshold', type: 'number', default: '50', description: 'Failure rate (0–100 %) that trips the breaker open.' },
                { prop: 'sampleSize', type: 'number', default: '10', description: 'Sliding window size — number of recent calls over which failure rate is measured.' },
                { prop: 'cooldownMs', type: 'number', default: '30000', description: 'Milliseconds to stay OPEN before attempting a single half-open probe.' },
                { prop: 'isFailure', type: '(err) => boolean', default: '() => true', description: 'Returns true for infrastructure errors that count against the breaker. Return false for business errors (4xx, domain rejections) to prevent phantom opens.' },
                { prop: 'onStateChange', type: '(prev, next, metrics) => void', description: 'Called on every state transition with a metrics snapshot. Use for alerting or logging.' },
                { prop: 'retry.attempts', type: 'number', default: '0', description: 'Number of retry attempts with exponential backoff + jitter before the breaker counts a failure.' },
                { prop: 'retry.baseDelayMs', type: 'number', default: '500', description: 'Initial retry delay in ms. Doubles each attempt.' },
              ]}
            />
          </section>

          <section id="nestjs">
            <SectionHeading id="nestjs">NestJS Integration</SectionHeading>
            <P>
              Register the module once, then use the decorator on any service method. The{' '}
              <C>CircuitBreakerRegistry</C> provides pre-configured factories so you do not need to
              tune thresholds for common patterns.
            </P>
            <CodeBlock
              filename="app.module.ts"
              code={`import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';

@Module({
  imports: [CircuitBreakerModule.forRoot()],
})
export class AppModule {}

// payment.service.ts
@Injectable()
export class PaymentService {
  @WithCircuitBreaker({ name: 'stripe', failureThreshold: 40, cooldownMs: 30_000 })
  async charge(dto: ChargeDto): Promise<Result<PaymentIntent, ChargeError>> {
    return this.stripeGateway.createCharge(dto);
    // result.error.type === 'circuit_open' when the breaker is open
  }
}`}
            />
            <SubHeading>CircuitBreakerRegistry</SubHeading>
            <P>
              Instead of tuning individual instances, the registry provides three pre-configured
              factory methods covering the most common scenarios:
            </P>
            <PropsTable
              rows={[
                { prop: 'getForHttpExternal(name)', type: 'CircuitBreaker', description: 'For calls to external HTTP APIs. 8-call window, 10-call sample, 5 s timeout.' },
                { prop: 'getForService(name)', type: 'CircuitBreaker', description: 'For internal microservice calls. 20-call window, 20-call sample, 10 s timeout.' },
                { prop: 'getForDatabase(name)', type: 'CircuitBreaker', description: 'For database connections. 15-call window, 15-call sample, 3 s timeout.' },
              ]}
            />
            <CodeBlock
              filename="registry.example.ts"
              code={`import { CircuitBreakerRegistry } from '@backendkit-labs/circuit-breaker';

const registry = new CircuitBreakerRegistry();

// Pre-tuned for external HTTP — no manual threshold guessing
const stripeBreaker  = registry.getForHttpExternal('stripe');
const dbBreaker      = registry.getForDatabase('postgres');
const orderBreaker   = registry.getForService('order-service');`}
            />
          </section>
        </>
      );
    },
  },

  bulkhead: {
    examples: [
      {
        label: 'Basic',
        filename: 'api.service.ts',
        code: `import { Bulkhead } from '@backendkit-labs/bulkhead';

const bh = new Bulkhead({
  name: 'external-api',
  maxConcurrent: 10,
  maxQueue: 50,
});

const result = await bh.execute(() => externalApi.fetch(payload));

if (!result.ok) {
  if (result.error.type === 'bulkhead_full') {
    throw new TooManyRequestsException('Downstream overloaded');
  }
}
return result.value;`,
      },
      {
        label: 'Intermediate',
        filename: 'external-api.service.ts',
        code: `@Injectable()
export class ExternalApiService {
  @UseBulkhead({ name: 'external-api', maxConcurrent: 10, maxQueue: 50 })
  async fetch(payload: FetchPayload): Promise<Result<ApiResponse, BulkheadError>> {
    return this.http.post<ApiResponse>('/api/data', payload);
  }

  // Stack bulkhead + circuit breaker for full resilience
  @UseCircuitBreaker({ name: 'external-api', failureThreshold: 30 })
  @UseBulkhead({ name: 'external-api', maxConcurrent: 10 })
  async criticalFetch(id: string): Promise<Result<ApiResponse, ResilienceError>> {
    return this.http.get<ApiResponse>(\`/api/data/\${id}\`);
  }
}`,
      },
      {
        label: 'Advanced',
        filename: 'product.service.ts',
        code: `// Different bulkheads per downstream — isolate failures
const bulkheads = {
  stripe:   new Bulkhead({ name: 'stripe',   maxConcurrent: 10, maxQueue: 30  }),
  database: new Bulkhead({ name: 'db',       maxConcurrent: 50, maxQueue: 200 }),
  cache:    new Bulkhead({ name: 'redis',    maxConcurrent: 100, maxQueue: 500 }),
};

async function getProductPrice(id: string): Promise<Result<number, AppError>> {
  // Try cache first (high concurrency allowed)
  const cached = await bulkheads.cache.execute(() => redis.get(\`price:\${id}\`));
  if (cached.ok && cached.value) return ok(JSON.parse(cached.value));

  // Fall back to DB (limited concurrency)
  const fromDb = await bulkheads.database.execute(() => db.products.findPrice(id));
  if (!fromDb.ok) return fromDb;

  // Non-blocking cache write — don't await
  void bulkheads.cache.execute(() => redis.setex(\`price:\${id}\`, 60, String(fromDb.value)));
  return fromDb;
}`,
      },
    ],
    content: function BulkheadContent({ color }) {
      return (
        <>
          <section id="overview">
            <SectionHeading id="overview">Overview</SectionHeading>
            <P>
              Borrowed from naval architecture: isolate compartments so one breach does not sink the
              ship. The bulkhead pattern limits the number of concurrent calls to a downstream
              service — preventing a slow dependency from exhausting your thread pool or connection
              pool and bringing down unrelated features.
            </P>
            <P>
              Unlike simple concurrency limiters (like <C>p-limit</C>), the bulkhead adds a{' '}
              <strong>wait queue with optional timeout</strong>: calls beyond{' '}
              <C>maxConcurrent</C> enter a FIFO queue and are executed as slots free up. If a call
              waits longer than <C>queueTimeoutMs</C>, it is rejected with a{' '}
              <C>BulkheadTimeoutError</C>. When even the queue is full, excess calls are shed
              immediately with <C>{'{ type: \'bulkhead_full\' }'}</C> — a clean, predictable signal
              your callers can act on.
            </P>
          </section>

          <section id="how-it-works">
            <SectionHeading id="how-it-works">How It Works</SectionHeading>
            <P>
              Each <C>Bulkhead</C> instance maintains a counter of in-flight executions. When{' '}
              <C>execute(fn)</C> is called:
            </P>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-[#94a3b8] mb-5 ml-4">
              {[
                'If in-flight < maxConcurrent → execute immediately.',
                'If in-flight ≥ maxConcurrent and queue < maxQueue → enter FIFO queue.',
                'If queued > queueTimeoutMs → reject with BulkheadTimeoutError.',
                'If queue is full → return fail({ type: \'bulkhead_full\' }) without waiting.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[#10b981] mt-0.5 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
            <P>
              The <C>BulkheadService</C> aggregates metrics across all registered instances and
              automatically emits warnings when utilization is high — no manual monitoring setup
              required.
            </P>
          </section>

          <section id="config">
            <SectionHeading id="config">Configuration</SectionHeading>
            <PropsTable
              rows={[
                { prop: 'name', type: 'string', description: 'Identifier for logs and metrics.' },
                { prop: 'maxConcurrent', type: 'number', description: 'Maximum simultaneous in-flight executions.' },
                { prop: 'maxQueue', type: 'number', default: '0', description: 'Maximum callers waiting when all slots are busy. 0 = reject immediately (no queue).' },
                { prop: 'queueTimeoutMs', type: 'number', default: 'Infinity', description: 'Maximum time a call can spend waiting in the queue. Exceeded calls fail with BulkheadTimeoutError.' },
              ]}
            />
          </section>

          <section id="nestjs">
            <SectionHeading id="nestjs">NestJS Integration</SectionHeading>
            <P>
              The <C>@WithBulkhead</C> decorator wraps any service method. The{' '}
              <C>BulkheadRegistry</C> provides pre-tuned factory methods for the four most common
              patterns, eliminating trial-and-error threshold tuning.
            </P>
            <CodeBlock
              filename="app.module.ts"
              code={`import { BulkheadModule } from '@backendkit-labs/bulkhead/nestjs';

@Module({ imports: [BulkheadModule.forRoot()] })
export class AppModule {}

@Injectable()
export class ExternalApiService {
  @WithBulkhead({ name: 'external-api', maxConcurrent: 10, maxQueue: 50, queueTimeoutMs: 5_000 })
  async fetch(payload: FetchPayload): Promise<Result<ApiResponse, BulkheadError>> {
    return this.http.post<ApiResponse>('/api/data', payload);
  }

  // Stack with circuit breaker for full resilience
  @WithCircuitBreaker({ name: 'external-api', failureThreshold: 30 })
  @WithBulkhead({ name: 'external-api', maxConcurrent: 10 })
  async criticalFetch(id: string): Promise<Result<ApiResponse, ResilienceError>> {
    return this.http.get<ApiResponse>(\`/api/data/\${id}\`);
  }
}`}
            />
            <SubHeading>BulkheadRegistry — pre-tuned factories</SubHeading>
            <PropsTable
              rows={[
                { prop: 'getForClient(name)', type: 'Bulkhead', description: '5 concurrent, queue 20, timeout 2 s — for per-client isolation.' },
                { prop: 'getForService(name)', type: 'Bulkhead', description: '20 concurrent, queue 200, timeout 10 s — for internal microservices.' },
                { prop: 'getForDatabase(name)', type: 'Bulkhead', description: '15 concurrent, queue 150, timeout 5 s — for database connection pools.' },
                { prop: 'getForHttpExternal(name)', type: 'Bulkhead', description: '8 concurrent, queue 50, timeout 10 s — for third-party HTTP APIs.' },
              ]}
            />
          </section>
        </>
      );
    },
  },

  observability: {
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
      metrics: { enabled: true, port: 9090 },
      tracing: { enabled: true, exporterUrl: 'http://otel-collector:4317' },
    }),
  ],
})
export class AppModule {}`,
      },
      {
        label: 'Logger & Metrics',
        filename: 'payment.service.ts',
        code: `@Injectable()
export class PaymentService {
  constructor(
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  @WithMetrics({ operation: 'payment.charge' })
  async charge(dto: ChargeDto): Promise<Result<Payment, PaymentError>> {
    this.logger.info('Processing charge', { userId: dto.userId, amount: dto.amount });
    // ↑ correlationId is injected on every log line automatically

    const result = await this.stripe.charge(dto);
    if (!result.ok) {
      this.metrics.increment('payment.failures', { reason: result.error.type });
    }
    return result;
  }
}`,
      },
      {
        label: 'Advanced OTel',
        filename: 'payment.service.ts',
        code: `@Injectable()
export class PaymentService {
  constructor(
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
    private readonly tracer: TracerService,
  ) {}

  async charge(dto: ChargeDto): Promise<Result<Payment, PaymentError>> {
    return this.tracer.startActiveSpan('payment.charge', async (span) => {
      span.setAttributes({
        'payment.userId': dto.userId,
        'payment.amount': dto.amount,
      });

      const startedAt = Date.now();
      const result = await this.doCharge(dto);
      const duration = Date.now() - startedAt;

      this.metrics.histogram('payment.duration', duration, {
        status: result.ok ? 'ok' : 'error',
      });

      if (!result.ok) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: result.error.type });
        this.logger.error('Charge failed', { error: result.error, durationMs: duration });
      }

      span.end();
      return result;
    });
  }
}`,
      },
    ],
    content: function ObservabilityContent({ color }) {
      return (
        <>
          <section id="overview">
            <SectionHeading id="overview">Overview</SectionHeading>
            <P>
              Observability is not three separate tools (logs, metrics, tracing) bolted together —
              it is the ability to understand the internal state of a system from its external
              outputs. In practice, most NestJS apps mix Winston, Prometheus, and OpenTelemetry with
              complex, fragile configurations where a saturated log ingester can degrade or crash
              the main API.
            </P>
            <P>
              <C>@backendkit-labs/observability</C> solves this with an integrated, resilient
              approach. A single <C>ObservabilityModule.forRoot()</C> import gives you:
            </P>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-[#94a3b8] mb-5 ml-4">
              {[
                'Automatic correlation ID propagation via AsyncLocalStorage — every log line in the entire async chain gets the same correlationId without manual threading.',
                'Structured Winston logging enriched with serviceName, environment, correlationId, traceId, and spanId automatically.',
                'Resilient telemetry transport: logs and metrics are sent in batches with a circuit breaker — if the ingester fails, the API is not affected.',
                'Fire-and-forget metrics: MetricsService calls are async and non-blocking — they never add latency to your request path.',
                'AllExceptionsFilter + ErrorMapper: centralizes HTTP error responses and maps domain exceptions to specific status codes declaratively.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[#8b5cf6] mt-0.5 flex-shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="setup">
            <SectionHeading id="setup">Module Setup</SectionHeading>
            <CodeBlock code="npm install @backendkit-labs/observability" />
            <PropsTable
              rows={[
                { prop: 'serviceName', type: 'string', description: 'Service name stamped on every log line, metric, and span.' },
                { prop: 'environment', type: 'string', description: 'Runtime environment (development, staging, production).' },
                { prop: 'logLevel', type: "'debug'|'info'|'warn'|'error'", default: "'info'", description: 'Minimum log level to output.' },
                { prop: 'logTransport.url', type: 'string', description: 'HTTP endpoint to batch-ship logs. Protected by an internal circuit breaker.' },
                { prop: 'logTransport.batchSize', type: 'number', default: '100', description: 'Number of log entries per batch.' },
                { prop: 'metrics.enabled', type: 'boolean', default: 'false', description: 'Expose a Prometheus /metrics HTTP scrape endpoint.' },
                { prop: 'metrics.port', type: 'number', default: '9090', description: 'Port for the /metrics endpoint.' },
                { prop: 'tracing.enabled', type: 'boolean', default: 'false', description: 'Enable OpenTelemetry tracing with W3C TraceContext propagation.' },
                { prop: 'tracing.exporterUrl', type: 'string', description: 'OTLP gRPC endpoint for span export (e.g. http://otel-collector:4317).' },
              ]}
            />
          </section>

          <section id="logger">
            <SectionHeading id="logger">LoggerService</SectionHeading>
            <P>
              Inject <C>LoggerService</C> anywhere. The correlation ID is propagated automatically
              via <C>AsyncLocalStorage</C> through the entire async call chain — no manual
              thread-local setup, no parameter threading. When OpenTelemetry tracing is enabled,{' '}
              <C>traceId</C> and <C>spanId</C> are appended too, making logs and traces directly
              correlatable.
            </P>
            <CodeBlock
              filename="payment.service.ts"
              code={`@Injectable()
export class PaymentService {
  constructor(private readonly logger: LoggerService) {}

  async charge(dto: ChargeDto) {
    this.logger.info('Processing charge', { userId: dto.userId, amount: dto.amount });
    // Output: { "level":"info", "message":"Processing charge",
    //           "userId":"usr_1", "amount":9900, "correlationId":"req-abc123",
    //           "traceId":"4bf92f3...", "spanId":"00f067aa0ba902b7" }

    // Available levels:
    this.logger.debug('Verbose detail');
    this.logger.warn('Unexpected but non-fatal condition');
    this.logger.error('Something failed', { error: someError });
  }
}`}
            />
          </section>

          <section id="metrics">
            <SectionHeading id="metrics">MetricsService</SectionHeading>
            <P>
              All metric operations are <strong>fire-and-forget</strong> — they never block the
              request path. The <C>@TrackPerformance</C> decorator automatically measures method
              duration, creates an OpenTelemetry span, and records success/error counters.
            </P>
            <CodeBlock
              filename="payment.service.ts"
              code={`// Automatic duration tracking + OTel span
@TrackPerformance({ operation: 'payment.charge' })
async charge(dto: ChargeDto): Promise<Result<Payment, PaymentError>> { ... }

// Manual metric recording
this.metrics.increment('payment.attempts', { currency: dto.currency });
this.metrics.increment('payment.failures', { reason: result.error.type });
this.metrics.histogram('payment.duration', durationMs, { status: 'ok' });
this.metrics.gauge('queue.depth', currentQueueSize);`}
            />
          </section>

          <section id="otel">
            <SectionHeading id="otel">OpenTelemetry</SectionHeading>
            <P>
              When <C>tracing.enabled</C> is true, the module configures an OTLP gRPC exporter and
              propagates W3C TraceContext headers automatically on every outgoing request. Inject{' '}
              <C>TracerService</C> for manual span control.
            </P>
            <CodeBlock
              filename="payment.service.ts"
              code={`@Injectable()
export class PaymentService {
  constructor(private readonly tracer: TracerService) {}

  async charge(dto: ChargeDto): Promise<Result<Payment, PaymentError>> {
    return this.tracer.startActiveSpan('payment.charge', async (span) => {
      span.setAttributes({ 'payment.userId': dto.userId, 'payment.amount': dto.amount });
      const result = await this.doCharge(dto);
      if (!result.ok) span.setStatus({ code: SpanStatusCode.ERROR, message: result.error.type });
      span.end();
      return result;
    });
  }
}`}
            />
            <SubHeading>AllExceptionsFilter & ErrorMapper</SubHeading>
            <P>
              Register <C>AllExceptionsFilter</C> globally to catch every unhandled exception and
              transform it into a consistent HTTP response shape. Use <C>ErrorMapper</C> to
              declaratively map domain errors to specific HTTP status codes — keeping business logic
              completely decoupled from HTTP concerns.
            </P>
            <CodeBlock
              filename="main.ts"
              code={`import { AllExceptionsFilter, ErrorMapper } from '@backendkit-labs/observability';

const mapper = new ErrorMapper()
  .map('not_found',       404)
  .map('forbidden',       403)
  .map('payment_failed',  402)
  .map('validation_error', 422);

app.useGlobalFilters(new AllExceptionsFilter(mapper));`}
            />
          </section>
        </>
      );
    },
  },

  pipeline: {
    examples: [
      {
        label: 'Basic',
        filename: 'payment.pipeline.ts',
        code: `import { Pipeline } from '@backendkit-labs/pipeline';

interface PaymentContext {
  userId: string; amount: number; currency: string; card: CardDto;
  fraudScore?: number;  // set by CheckFraudHandler
  chargeId?: string;    // set by ChargeStripeHandler
}

const pipeline = new Pipeline<PaymentContext>()
  .pipe(new ValidateCardHandler())
  .pipe(new CheckFraudHandler())
  .pipe(new ChargeStripeHandler())
  .pipe(new SendReceiptHandler());

const result = await pipeline.run({ userId, amount, currency: 'usd', card });

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
  constructor(private readonly fraud: FraudService) { super(); }

  async handle(
    ctx: PaymentContext,
  ): Promise<Result<PaymentContext, FraudError>> {
    const score = await this.fraud.score({ userId: ctx.userId, amount: ctx.amount });

    if (score > 80) {
      return fail({ type: 'fraud_detected', score, userId: ctx.userId });
    }

    // Return enriched context — the next handler sees fraudScore set
    return ok({ ...ctx, fraudScore: score });
  }
}`,
      },
      {
        label: 'Collect-all',
        filename: 'validation.pipeline.ts',
        code: `// collect-all mode — all handlers run even when one fails
const validationPipeline = new Pipeline<OrderContext>({ mode: 'collect-all' })
  .pipe(new ValidateEmailHandler())
  .pipe(new ValidateAddressHandler())
  .pipe(new ValidatePaymentHandler())
  .pipe(new ValidateInventoryHandler());

const result = await validationPipeline.run(orderCtx);

if (!result.ok) {
  // result.errors is an array — every failing handler contributed
  return res.status(422).json({
    errors: result.errors.map(e => ({ field: e.field, message: e.message })),
  });
}`,
      },
    ],
    content: function PipelineContent({ color }) {
      return (
        <>
          <section id="overview">
            <SectionHeading id="overview">Overview</SectionHeading>
            <P>
              Orchestrating a sequence of steps — validation, enrichment, side effects — is
              extremely common but leads to deeply nested, hard-to-test code. The Pipeline
              implements the Chain of Responsibility pattern for async, typed workflows: each handler
              receives a typed context, optionally enriches it, and returns a <C>Result</C>. The
              pipeline routes success forward and short-circuits on failure — or collects all errors
              in a single pass, depending on the mode.
            </P>
            <P>
              Each call to <C>.pipe()</C> returns a <strong>new immutable pipeline</strong>, so you
              can share a base pipeline and extend it without side effects. The result includes the
              final context, any collected errors, and an <C>executedSteps</C> list useful for
              debugging.
            </P>
          </section>

          <section id="building">
            <SectionHeading id="building">Building a Pipeline</SectionHeading>
            <P>
              Create a <C>Pipeline</C> typed with your context shape, then <C>.pipe()</C> handler
              instances in order. Use <C>.pipeIf(predicate, handler)</C> for conditional steps that
              only run when the predicate returns true. Call <C>.run(initialContext)</C> to execute.
            </P>
            <CodeBlock
              filename="payment.pipeline.ts"
              code={`const pipeline = new Pipeline<PaymentContext>()
  .pipe(new ValidateCardHandler())
  .pipe(new CheckFraudHandler())
  .pipeIf(ctx => ctx.amount > 100, new RequireManagerApprovalHandler())
  .pipe(new ChargeStripeHandler());

const result = await pipeline.run({ userId, amount, card });

if (!result.ok) {
  // result.executedSteps shows which handlers ran before the failure
  logger.debug('Pipeline failed', { steps: result.executedSteps, error: result.error });
}`}
            />
          </section>

          <section id="handlers">
            <SectionHeading id="handlers">Writing Handlers</SectionHeading>
            <P>
              Extend <C>PipelineHandler&lt;TContext&gt;</C> and implement <C>handle(ctx)</C>.
              Return <C>ok(enrichedCtx)</C> to continue the chain, or <C>fail(error)</C> to abort.
              The enriched context — with new fields set — flows directly into the next handler.
            </P>
            <CodeBlock
              filename="check-fraud.handler.ts"
              code={`export class CheckFraudHandler extends PipelineHandler<PaymentContext> {
  async handle(ctx: PaymentContext): Promise<Result<PaymentContext, FraudError>> {
    const score = await this.fraud.score({ userId: ctx.userId, amount: ctx.amount });
    if (score > 80) return fail({ type: 'fraud_detected', score });
    return ok({ ...ctx, fraudScore: score }); // next handler sees fraudScore
  }
}`}
            />
          </section>

          <section id="modes">
            <SectionHeading id="modes">Execution Modes</SectionHeading>
            <PropsTable
              rows={[
                { prop: 'stop-on-first', type: 'default', description: 'Stops at the first handler returning Fail. Result<Ctx, E> with the single error. Ideal for transactional flows.' },
                { prop: 'collect-all', type: "mode: 'collect-all'", description: 'All handlers run regardless of failures. Result<Ctx, E[]> with every error. Ideal for form validation.' },
              ]}
            />
            <SubHeading>Observability hooks</SubHeading>
            <P>
              Attach hooks to instrument every step without modifying handler code. Use them for
              logging, metrics, or tracing.
            </P>
            <PropsTable
              rows={[
                { prop: 'onStepStart(step, ctx)', type: 'void', description: 'Called immediately before each handler executes.' },
                { prop: 'onStepSuccess(step, ctx)', type: 'void', description: 'Called after each handler returns ok.' },
                { prop: 'onStepError(step, err)', type: 'void', description: 'Called when a handler returns fail.' },
                { prop: 'onPipelineStart(ctx)', type: 'void', description: 'Called before the first step.' },
                { prop: 'onPipelineEnd(result)', type: 'void', description: 'Called after the last step with the final result.' },
              ]}
            />
          </section>

          <section id="nestjs">
            <SectionHeading id="nestjs">NestJS Integration</SectionHeading>
            <P>
              Use <C>definePipeline()</C> to create a typed token, register factories in{' '}
              <C>PipelineModule.forRoot()</C>, and inject pipelines into any service — all with full
              DI support for handler dependencies.
            </P>
            <CodeBlock
              filename="payment.module.ts"
              code={`import { PipelineModule, definePipeline } from '@backendkit-labs/pipeline/nestjs';

export const PAYMENT_PIPELINE = definePipeline<PaymentContext, PaymentError>();

@Module({
  imports: [
    PipelineModule.forRoot([
      {
        token: PAYMENT_PIPELINE,
        factory: (fraud: FraudService) => new Pipeline<PaymentContext>()
          .pipe(new ValidateCardHandler())
          .pipe(new CheckFraudHandler(fraud))
          .pipe(new ChargeStripeHandler()),
        inject: [FraudService],
      },
    ]),
  ],
})
export class PaymentModule {}

@Injectable()
export class PaymentService {
  constructor(
    @InjectPipeline(PAYMENT_PIPELINE)
    private readonly pipeline: Pipeline<PaymentContext, PaymentError>,
  ) {}
}`}
            />
          </section>
        </>
      );
    },
  },

  'http-client': {
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

const result = await github.get<Repository>('/repos/owner/repo');

if (result.ok) {
  return result.value.stargazers_count; // typed Repository
}
// result.error.type: 'timeout' | 'network_error' | 'http_error'`,
      },
      {
        label: 'Retry & CB',
        filename: 'stripe.client.ts',
        code: `const stripe = new HttpClient({
  baseUrl: 'https://api.stripe.com/v1',
  timeout: 10_000,
  defaultHeaders: { Authorization: \`Bearer \${process.env.STRIPE_KEY}\` },
  retry: {
    attempts: 3,
    baseDelay: 500,         // 500 ms → 1 s → 2 s (exponential)
    retryOn: ['network_error', 'timeout'],
  },
  circuitBreaker: {
    name: 'stripe',
    failureThreshold: 40,
    cooldownMs: 30_000,
  },
});

const result = await stripe.post<PaymentIntent>('/payment_intents', { amount, currency });`,
      },
      {
        label: 'NestJS',
        filename: 'payment.module.ts',
        code: `// Register named instances in the module
@Module({
  imports: [
    HttpClientModule.register([
      {
        token: 'STRIPE_CLIENT',
        config: {
          baseUrl: 'https://api.stripe.com/v1',
          timeout: 10_000,
          retry: { attempts: 3, baseDelay: 500 },
          circuitBreaker: { name: 'stripe', failureThreshold: 40 },
        },
      },
    ]),
  ],
})
export class PaymentModule {}

// Inject by token
@Injectable()
export class PaymentService {
  constructor(
    @InjectHttpClient('STRIPE_CLIENT') private readonly stripe: HttpClient,
  ) {}
}`,
      },
    ],
    content: function HttpClientContent({ color }) {
      return (
        <>
          <section id="overview">
            <SectionHeading id="overview">Overview</SectionHeading>
            <P>
              Making HTTP calls is one of the most common and most failure-prone backend tasks.
              Popular libraries like Axios and Got treat failures as exceptions — forcing every
              caller to wrap calls with <C>try/catch</C>, manage retries manually, and wire up
              circuit breakers separately.
            </P>
            <P>
              <C>@backendkit-labs/http-client</C> is built on Axios for ecosystem compatibility
              but integrates the full BackendKit pattern stack natively:
            </P>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-[#94a3b8] mb-5 ml-4">
              {[
                'Every response is Result<T, HttpClientError> — no try/catch anywhere.',
                'Built-in exponential backoff + jitter retry for transient errors.',
                'Integrated circuit breaker using the same isFailure semantics as @backendkit-labs/circuit-breaker.',
                'Cancellation by key (for polling) and mass cancellation when shutting down.',
                'Middleware as pipeline steps: auth headers, logging, rate limiting — all composable and testable.',
                'defineHttpClient<T>() creates fully typed client contracts injectable via NestJS DI.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[#f59e0b] mt-0.5 flex-shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="config">
            <SectionHeading id="config">Configuration</SectionHeading>
            <CodeBlock code="npm install @backendkit-labs/http-client axios" />
            <PropsTable
              rows={[
                { prop: 'baseUrl', type: 'string', description: 'Base URL prepended to all requests.' },
                { prop: 'timeout', type: 'number', default: '10000', description: 'Request timeout in milliseconds.' },
                { prop: 'defaultHeaders', type: 'Record<string, string>', description: 'Headers included on every request.' },
                { prop: 'retry.attempts', type: 'number', default: '0', description: 'Number of retry attempts after the initial failure.' },
                { prop: 'retry.baseDelay', type: 'number', default: '500', description: 'Initial delay in ms. Doubles on each retry (exponential backoff + jitter).' },
                { prop: 'retry.retryOn', type: 'string[]', description: "Error types to retry: 'network_error' | 'timeout'." },
                { prop: 'circuitBreaker', type: 'CircuitBreakerConfig', description: 'Inline circuit breaker — same isFailure semantics as @backendkit-labs/circuit-breaker.' },
              ]}
            />
          </section>

          <section id="requests">
            <SectionHeading id="requests">Making Requests</SectionHeading>
            <PropsTable
              rows={[
                { prop: 'get<T>(path, cfg?)', type: 'Promise<Result<T, E>>', description: 'GET request.' },
                { prop: 'post<T>(path, body, cfg?)', type: 'Promise<Result<T, E>>', description: 'POST with JSON body.' },
                { prop: 'put<T>(path, body, cfg?)', type: 'Promise<Result<T, E>>', description: 'PUT with JSON body.' },
                { prop: 'patch<T>(path, body, cfg?)', type: 'Promise<Result<T, E>>', description: 'PATCH with JSON body.' },
                { prop: 'delete<T>(path, cfg?)', type: 'Promise<Result<T, E>>', description: 'DELETE request.' },
                { prop: 'cancelByKey(key)', type: 'void', description: 'Cancel all in-flight requests with the given key. Useful for polling.' },
                { prop: 'cancelAll()', type: 'void', description: 'Cancel every in-flight request — use on shutdown.' },
              ]}
            />
          </section>

          <section id="errors">
            <SectionHeading id="errors">Error Types</SectionHeading>
            <PropsTable
              rows={[
                { prop: 'timeout', type: 'HttpClientError', description: 'Request exceeded the configured timeout.' },
                { prop: 'network_error', type: 'HttpClientError', description: 'Connection refused, DNS failure, or network unreachable.' },
                { prop: 'http_error', type: 'HttpClientError', description: 'Server responded with 4xx or 5xx. Includes status and response body.' },
                { prop: 'circuit_open', type: 'HttpClientError', description: 'Integrated circuit breaker is open — request was not sent.' },
                { prop: 'cancelled', type: 'HttpClientError', description: 'Request was cancelled via cancelByKey() or cancelAll().' },
              ]}
            />
          </section>

          <section id="resilience">
            <SectionHeading id="resilience">Retry & Circuit Breaker</SectionHeading>
            <P>
              Retry uses exponential backoff with jitter to prevent thundering herd: each attempt
              waits <C>baseDelay × 2ⁿ + random</C> ms. The circuit breaker wraps the full
              retry cycle — if the breaker opens mid-retry, the attempt fails immediately without
              exhausting remaining retries.
            </P>
            <SubHeading>Typed NestJS clients</SubHeading>
            <P>
              <C>defineHttpClient&lt;T&gt;()</C> creates a strongly-typed DI token. Register
              instances once in the module; inject by token anywhere.
            </P>
            <CodeBlock
              filename="payment.module.ts"
              code={`import { HttpClientModule, defineHttpClient } from '@backendkit-labs/http-client/nestjs';

export const STRIPE_CLIENT = defineHttpClient<StripeClient>();

@Module({
  imports: [
    HttpClientModule.forRoot({
      clients: [
        {
          token: STRIPE_CLIENT,
          config: {
            baseUrl: 'https://api.stripe.com/v1',
            timeout: 10_000,
            retry: { attempts: 3, baseDelay: 500 },
            circuitBreaker: { name: 'stripe', failureThreshold: 40 },
          },
        },
      ],
    }),
  ],
})
export class PaymentModule {}

@Injectable()
export class PaymentService {
  constructor(
    @InjectHttpClient(STRIPE_CLIENT) private readonly stripe: StripeClient,
  ) {}
}`}
            />
          </section>
        </>
      );
    },
  },

  'request-scanner': {
    examples: [
      {
        label: 'Middleware',
        filename: 'security.middleware.ts',
        code: `import { RequestScanner } from '@backendkit-labs/request-scanner';

const scanner = new RequestScanner({
  level: 'strict',
  allowList: ['/admin/raw-query'],
});

app.use((req, res, next) => {
  const threats = scanner.scan({
    body: req.body, query: req.query,
    headers: req.headers, path: req.path,
  });

  if (threats.length > 0) {
    return res.status(403).json({ error: 'Blocked', rule: threats[0].ruleId });
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
    return { level: 'strict', allowList: ['/api/admin/raw-query'] };
  }
}

@Controller('api')
@UseGuards(HttpScannerGuard)
export class ApiController {
  @Post('search')
  async search(@Body() dto: SearchDto) {
    return this.service.search(dto); // injection attempts already blocked
  }
}`,
      },
      {
        label: 'Custom Rules',
        filename: 'scanner.config.ts',
        code: `const scanner = new RequestScanner({
  level: 'standard',
  customRules: [
    {
      id: 'custom-001',
      description: 'Block known bad actor IPs',
      severity: 'high',
      test: (req) => BLOCKED_IPS.includes(req.headers['x-forwarded-for'] as string),
    },
    {
      id: 'custom-002',
      description: 'Detect excessive query parameter length',
      severity: 'medium',
      test: (req) => Object.values(req.query).some(v => String(v).length > 2000),
    },
  ],
  onThreat: (threat, req) => {
    logger.warn('Security threat detected', { ruleId: threat.ruleId, path: req.path });
    metrics.increment('security.threats', { rule: threat.ruleId });
  },
});`,
      },
    ],
    content: function RequestScannerContent({ color }) {
      return (
        <>
          <section id="overview">
            <SectionHeading id="overview">Overview</SectionHeading>
            <P>
              A WAF (Web Application Firewall) typically runs at the reverse proxy layer
              (Cloudflare, AWS WAF, Nginx). But many environments — serverless, on-premise,
              platforms without WAF access — cannot rely on that layer. Even when available,
              fine-grained business rules often require decisions the proxy cannot make.
            </P>
            <P>
              <C>@backendkit-labs/request-scanner</C> is an <strong>embedded WAF</strong> that
              runs inside your Node.js process, inspecting every request before it touches business
              logic. Two capabilities set it apart from simpler middleware:
            </P>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-[#94a3b8] mb-5 ml-4">
              {[
                'Recursive deep scanning: inspects nested objects and arrays — not just top-level values.',
                'Object key scanning: detects NoSQL injection via operator keys like { "$where": ... } or { "$ne": null } — not just values.',
                'DoS protection: maxDepth (default 10) and maxStringLength (default 10000) caps prevent resource exhaustion from deeply-nested or oversized payloads.',
                'SSRF rules are disabled by default to prevent false positives in apps that legitimately process URLs.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-[#ef4444] mt-0.5 flex-shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="rules">
            <SectionHeading id="rules">Detection Rules</SectionHeading>
            <P>
              23 built-in rules across 6 categories. Each rule has a configurable severity
              (block, log-only, or disabled) per detection level.
            </P>
            <PropsTable
              rows={[
                { prop: 'sql-001–004', type: 'SQLi', description: 'UNION SELECT, DDL (DROP/TRUNCATE/ALTER), catalog enumeration, time-based blind (SLEEP/WAITFOR).' },
                { prop: 'xss-001–002', type: 'XSS', description: 'Script tag injection, dangerous URI schemes (javascript:, vbscript:).' },
                { prop: 'pt-001–002', type: 'Path Traversal', description: 'Directory traversal sequences (../ and ..\\ variants), sensitive file path access.' },
                { prop: 'nosql-001–003', type: 'NoSQL', description: 'MongoDB operator injection ($where, $ne, $regex, $gt) — in both keys and values.' },
                { prop: 'ssrf-001–003', type: 'SSRF', description: 'Internal IP ranges, loopback addresses, cloud metadata endpoints. Disabled by default.' },
                { prop: 'cmd-001–002', type: 'Command Injection', description: 'Shell operator chaining (;, |, &&), system command patterns.' },
              ]}
            />
          </section>

          <section id="config">
            <SectionHeading id="config">Configuration</SectionHeading>
            <CodeBlock code="npm install @backendkit-labs/request-scanner" />
            <PropsTable
              rows={[
                { prop: 'level', type: "'permissive'|'standard'|'strict'", default: "'standard'", description: "Detection sensitivity. 'strict' activates all 23 rules with zero tolerance." },
                { prop: 'allowList', type: 'string[]', default: '[]', description: 'Paths that bypass all scanning (e.g. trusted admin or webhook endpoints).' },
                { prop: 'maxDepth', type: 'number', default: '10', description: 'Maximum object nesting depth to scan. Deeper structures are truncated to prevent DoS.' },
                { prop: 'maxStringLength', type: 'number', default: '10000', description: 'Maximum string length to scan. Longer strings are truncated.' },
                { prop: 'customRules', type: 'Rule[]', description: 'Additional rules to run alongside the built-in set.' },
                { prop: 'onThreat', type: '(threat, req) => void', description: 'Callback invoked on every detected threat. Use for logging, metrics, or alerting.' },
              ]}
            />
            <SubHeading>Environment variable overrides</SubHeading>
            <CodeBlock
              code={`WAF_ENABLED=true            # globally enable/disable (default: true)
WAF_SSRF_ENABLED=false      # enable SSRF rules when you don't process URLs
WAF_EXCLUDE_PATHS=/health,/metrics  # comma-separated bypass paths`}
            />
          </section>

          <section id="middleware">
            <SectionHeading id="middleware">Express Middleware</SectionHeading>
            <P>
              Call <C>scanner.scan()</C> with the request body, query, headers, and path. Returns
              an array of detected threats — an empty array means the request is clean.
            </P>
          </section>

          <section id="nestjs">
            <SectionHeading id="nestjs">NestJS Guard</SectionHeading>
            <P>
              Extend <C>ScannerGuard</C> and implement <C>getConfig()</C>. Apply per-controller
              with <C>@UseGuards()</C>, globally in <C>main.ts</C>, or per-method with{' '}
              <C>@UseWafPipe()</C> for endpoint-level policies.
            </P>
            <CodeBlock
              filename="main.ts"
              code={`// Global — protects all routes
const scanner = new RequestScanner({ level: 'standard' });
app.useGlobalGuards(new ScannerGuard(scanner));

// Per-route — stricter policy on sensitive endpoints
@Post('search')
@UseWafPipe({ level: 'strict', onThreat: (t) => metrics.increment('security.threat') })
async search(@Body() dto: SearchDto) { ... }`}
            />
          </section>
        </>
      );
    },
  },

  'console-animations': {
    examples: [
      {
        label: 'Basic',
        filename: 'spinner.ts',
        code: `import { AnimationManager, AnimationType } from '@backendkit-labs/console-animations';

const manager = new AnimationManager();

const spinner = manager.start({
  type: AnimationType.SPINNER,
  text: 'Fetching data...',
  color: 'cyan',
  speed: 80,
});

await fetchData();

manager.stop(spinner.id);
console.log('Done.');`,
      },
      {
        label: 'Builder',
        filename: 'custom.ts',
        code: `import { AnimationBuilder, AnimationType } from '@backendkit-labs/console-animations';

const anim = new AnimationBuilder()
  .withType(AnimationType.DOTS)
  .withText('Processing records')
  .withColor('yellow')
  .withSpeed(120)
  .build();

anim.start();
await processRecords();
anim.stop();`,
      },
      {
        label: 'Multi-phase',
        filename: 'deploy.ts',
        code: `import { AnimationManager, AnimationType } from '@backendkit-labs/console-animations';

const manager = new AnimationManager();

const build = manager.start({ type: AnimationType.SPINNER, text: 'Building', color: 'cyan' });
await triggerBuild();
manager.stop(build.id);

const poll = manager.start({ type: AnimationType.DOTS, text: 'Waiting for CI', color: 'yellow' });
await pollBuildStatus();
manager.stop(poll.id);

const deploy = manager.start({ type: AnimationType.PROGRESS_BAR, text: 'Promoting', color: 'green', width: 30 });
await promote();
manager.stop(deploy.id);

manager.destroyAll();`,
      },
    ],
    content: function ConsoleAnimationsContent({ color }: { color: string }) {
      return (
        <>
          <section id="overview">
            <SectionHeading id="overview">Overview</SectionHeading>
            <P>
              CLI tools that run async operations — builds, deployments, migrations — leave operators
              staring at a blank terminal for 30–120 seconds with no indication that the process is
              still alive. Without feedback, a working process looks identical to a hung one, and
              operators kill it prematurely.
            </P>
            <P>
              <C>@backendkit-labs/console-animations</C> provides 17 production-grade animation
              presets with a consistent lifecycle API: <C>start()</C>, <C>stop(id)</C>, and{' '}
              <C>destroyAll()</C>. No raw terminal control codes, no TTY handling — just clean
              primitives that compose with any async workflow.
            </P>
          </section>

          <section id="types">
            <SectionHeading id="types">Animation Types</SectionHeading>
            <P>17 built-in presets across four semantic categories:</P>
            <div className="grid sm:grid-cols-2 gap-3 my-5">
              {([
                { category: 'Indeterminate', accent: '#06b6d4', types: ['SPINNER', 'DOTS', 'WORM', 'SNAKE'],                                   desc: 'Best for operations with unknown duration — async triggers, network calls, polling.' },
                { category: 'Bounded',       accent: '#10b981', types: ['PROGRESS_BAR', 'PULSE'],                                              desc: 'Best for operations with known or estimated progress — file uploads, batch processing.' },
                { category: 'Thematic',      accent: '#8b5cf6', types: ['MATRIX', 'HACKER', 'CYBERPUNK', 'FIRE'],                             desc: 'High-visual-impact presets for branded or security-themed CLI tools.' },
                { category: 'Ambient',       accent: '#f59e0b', types: ['RAIN', 'STARS', 'PARTICLES', 'WAVES', 'TYPING', 'BOUNCING_BALL', 'FUTURISTA'], desc: 'Background atmosphere for long idle periods or splash screens.' },
              ] as const).map(({ category, accent, types, desc }) => (
                <div
                  key={category}
                  className="rounded-xl border border-gray-200 dark:border-white/[0.06] p-4"
                  style={{ background: `${accent}06` }}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: accent }}>
                    {category}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {types.map((t) => (
                      <span
                        key={t}
                        className="font-mono text-[11px] px-1.5 py-0.5 rounded"
                        style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-[13px] text-slate-500 dark:text-[#64748b] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="manager">
            <SectionHeading id="manager">AnimationManager</SectionHeading>
            <P>
              <C>AnimationManager</C> is the primary entry point. It manages the full lifecycle of
              one or more concurrent animations and provides id-based tracking so you can stop the
              right animation in multi-phase flows without keeping track of references manually.
            </P>
            <PropsTable
              rows={[
                { prop: 'start(options)', type: 'Animation', description: 'Starts an animation and returns a handle with an id for later stop/query.' },
                { prop: 'stop(id)',       type: 'void',      description: 'Stops a specific animation by id. Clears the terminal line.' },
                { prop: 'stopAll()',      type: 'void',      description: 'Stops all currently running animations.' },
                { prop: 'destroyAll()',   type: 'void',      description: 'Stops and frees all resources. Call at process exit or after the final phase.' },
                { prop: 'getRunning()',   type: 'Animation[]', description: 'Returns all currently active animation handles.' },
              ]}
            />
          </section>

          <section id="builder">
            <SectionHeading id="builder">AnimationBuilder</SectionHeading>
            <P>
              <C>AnimationBuilder</C> provides a fluent interface for constructing animations
              programmatically — useful when animation config is computed at runtime or when you want
              to pass pre-built animations as arguments to higher-order functions.
            </P>
            <CodeBlock
              filename="custom-animation.ts"
              code={`import { AnimationBuilder, AnimationType } from '@backendkit-labs/console-animations';

const anim = new AnimationBuilder()
  .withType(AnimationType.MATRIX)
  .withText('Establishing secure connection')
  .withColor('green')
  .withSpeed(50)
  .build();

anim.start();
await connect();
anim.stop();`}
            />
          </section>
        </>
      );
    },
  },

  'auto-learning': {
    examples: [
      {
        label: 'Standalone',
        filename: 'learning.service.ts',
        code: `import { AutoLearningCore } from '@backendkit-labs/auto-learning';

const learner = AutoLearningCore.create();

learner.recordPattern({
  method: 'POST',
  path: '/api/payments',
  statusCode: 200,
  durationMs: 145,
  timestamp: new Date(),
});

learner.onConfigChange((config) => {
  circuitBreaker.setThreshold(config.circuitBreakerThreshold);
  bulkhead.setMaxConcurrent(config.bulkheadMaxConcurrent);
  httpClient.setTimeout(config.timeoutMs);
});

learner.startFeedbackLoop(60_000);`,
      },
      {
        label: 'NestJS',
        filename: 'app.module.ts',
        code: `import { AutoLearningModule, AutoLearn } from '@backendkit-labs/auto-learning';

@Module({
  imports: [
    AutoLearningModule.forRoot({
      feedbackIntervalMs: 60_000,
      anomaly: {
        latencyStdDevThreshold: 2.5,
        errorRateThreshold: 0.15,
      },
    }),
  ],
})
export class AppModule {}

// ----- payment.controller.ts -----
@Controller('payments')
export class PaymentController {
  @Post()
  @AutoLearn()
  async charge(@Body() dto: ChargeDto): Promise<PaymentResult> {
    return this.paymentService.charge(dto);
  }
}`,
      },
      {
        label: 'Custom Storage',
        filename: 'redis-storage.adapter.ts',
        code: `import { StorageAdapter, EndpointPattern, TunableConfig } from '@backendkit-labs/auto-learning';
import { ok } from '@backendkit-labs/result';
import type { Redis } from 'ioredis';

export class RedisStorageAdapter implements StorageAdapter {
  constructor(private readonly redis: Redis) {}

  async savePattern(pattern: EndpointPattern) {
    const key = \`patterns:\${pattern.method}:\${pattern.path}\`;
    await this.redis.lpush(key, JSON.stringify(pattern));
    await this.redis.ltrim(key, 0, 999);
    return ok(undefined);
  }

  async loadConfig() {
    const raw = await this.redis.get('auto-learning:config');
    if (!raw) return ok(null);
    return ok(JSON.parse(raw) as TunableConfig);
  }

  async saveConfig(config: TunableConfig) {
    await this.redis.set('auto-learning:config', JSON.stringify(config));
    return ok(undefined);
  }
}`,
      },
    ],
    content: function AutoLearningContent({ color }: { color: string }) {
      return (
        <>
          <section id="overview">
            <SectionHeading id="overview">Overview</SectionHeading>
            <P>
              <code>@backendkit-labs/auto-learning</code> observes your backend in production and continuously tunes its
              resilience configuration. Every endpoint call is recorded as a pattern; a periodic feedback loop analyzes those
              patterns, detects anomalies, and emits an updated <code>TunableConfig</code> that your circuit breaker,
              bulkhead, and HTTP client can consume immediately.
            </P>
            <div className="flex flex-wrap gap-2 mt-3">
              {['87 tests', '>94% coverage', 'Zero ML deps', 'Pluggable storage'].map((item) => (
                <span key={item} className="text-[12px] font-medium px-2.5 py-1 rounded-lg" style={{ background: `${color}15`, color }}>{item}</span>
              ))}
            </div>
          </section>

          <section id="how-it-works">
            <SectionHeading id="how-it-works">How It Works</SectionHeading>
            <P>The learning cycle runs in four stages:</P>
            <div className="grid sm:grid-cols-2 gap-3 my-5">
              {([
                { step: '1. Record', accent: '#0ea5e9', desc: 'Every endpoint call is captured as an EndpointPattern — method, path, status, duration, timestamp.' },
                { step: '2. Aggregate', accent: '#6366f1', desc: 'PatternRegistry groups calls by endpoint and computes p50/p95/p99 latency, error rate, and call frequency.' },
                { step: '3. Detect', accent: '#f59e0b', desc: 'AnomalyDetector uses z-score and percentile analysis to flag latency spikes, error surges, frequency shifts, and unknown endpoints.' },
                { step: '4. Tune', accent: '#10b981', desc: 'ConfigTuner adjusts timeoutMs, maxRetries, circuitBreakerThreshold, and bulkheadMaxConcurrent based on detected anomalies.' },
              ] as const).map(({ step, accent, desc }) => (
                <div key={step} className="rounded-xl border border-gray-200 dark:border-white/[0.06] p-4" style={{ background: `${accent}06` }}>
                  <div className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: accent }}>{step}</div>
                  <p className="text-[13px] text-slate-500 dark:text-[#64748b] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="config">
            <SectionHeading id="config">Configuration</SectionHeading>
            <P>All options are optional — the defaults work for most backends.</P>
            <PropsTable rows={[
              { prop: 'feedbackIntervalMs',               type: 'number',            default: '60000',          description: 'How often the learning cycle runs (ms).' },
              { prop: 'anomaly.latencyStdDevThreshold',   type: 'number',            default: '2.0',            description: 'Z-score threshold for latency spike detection.' },
              { prop: 'anomaly.errorRateThreshold',       type: 'number',            default: '0.10',           description: 'Error rate fraction that triggers an anomaly (0.10 = 10%).' },
              { prop: 'tuner.cooldownMs',                 type: 'number',            default: '120000',         description: 'Minimum time between config adjustments.' },
              { prop: 'storage',                          type: 'StorageAdapter',    default: 'InMemoryStorage', description: 'Pluggable persistence layer.' },
              { prop: 'observability',                    type: 'ObservabilityAdapter', default: 'NoopAdapter', description: 'Pluggable logging and metrics.' },
            ]} />
          </section>

          <section id="nestjs">
            <SectionHeading id="nestjs">NestJS Integration</SectionHeading>
            <P>
              <code>AutoLearningModule.forRoot()</code> registers the core instance as a singleton.
              The <code>@AutoLearn()</code> decorator marks controllers or methods for automatic pattern recording
              via an interceptor — no manual <code>recordPattern()</code> calls needed.
            </P>
            <CodeBlock filename="resilience.service.ts" code={`@Injectable()
export class ResilienceService implements OnModuleInit {
  constructor(
    @Inject(AUTO_LEARNING_INSTANCE)
    private readonly learner: AutoLearningCore,
  ) {}

  onModuleInit() {
    this.learner.onConfigChange((config) => {
      this.circuitBreaker.setThreshold(config.circuitBreakerThreshold);
      this.bulkhead.setMaxConcurrent(config.bulkheadMaxConcurrent);
    });
  }
}`} />
          </section>

          <section id="storage">
            <SectionHeading id="storage">Storage Adapters</SectionHeading>
            <P>
              The default <code>InMemoryStorage</code> loses data on restart — suitable for development.
              For production, implement <code>StorageAdapter</code> backed by Redis or SQL.
            </P>
            <PropsTable rows={[
              { prop: 'savePattern(pattern)', type: 'Promise<Result>', default: '—', description: 'Persist an endpoint pattern observation.' },
              { prop: 'getAggregates()',      type: 'Promise<Result>', default: '—', description: 'Load aggregated statistics per endpoint.' },
              { prop: 'saveConfig(config)',   type: 'Promise<Result>', default: '—', description: 'Persist the latest tuned configuration.' },
              { prop: 'loadConfig()',         type: 'Promise<Result>', default: '—', description: 'Load the last saved configuration on startup.' },
              { prop: 'prune(olderThan)',     type: 'Promise<Result>', default: '—', description: 'Remove patterns older than the given date.' },
            ]} />
          </section>
        </>
      );
    },
  },
};

// ── Comparison tables data ───────────────────────────────────────────────────

const comparisonData: Record<string, {
  intro: string;
  ours: string;
  alternatives: string[];
  rows: ComparisonRow[];
}> = {
  result: {
    intro: 'Comparing @backendkit-labs/result against the most popular Result/Either libraries in the TypeScript ecosystem.',
    ours: '@backendkit-labs/result',
    alternatives: ['neverthrow', 'ts-results'],
    rows: [
      { feature: 'map / flatMap',         ours: '✅', alt1: '✅', alt2: '✅' },
      { feature: 'Async map helpers',     ours: '✅ Built-in', alt1: '⚠️ ResultAsync class', alt2: '❌ Manual' },
      { feature: 'Zero runtime deps',     ours: '✅', alt1: '✅', alt2: '✅' },
      { feature: 'Full TS inference',     ours: '✅', alt1: '✅', alt2: '✅' },
      { feature: 'Native BK integration', ours: '✅ circuit-breaker, pipeline, http-client', alt1: '❌', alt2: '❌' },
      { feature: 'NestJS module',         ours: '✅', alt1: '❌', alt2: '❌' },
      { feature: 'Weekly downloads',      ours: 'Growing', alt1: '~500k', alt2: '~100k' },
    ],
  },
  'circuit-breaker': {
    intro: 'Comparing against opossum — the most popular and established circuit breaker library in the Node.js ecosystem.',
    ours: '@backendkit-labs/circuit-breaker',
    alternatives: ['opossum (v9)'],
    rows: [
      { feature: 'Business error classification', ours: '✅ isBusinessError()', alt1: '❌ All errors equal' },
      { feature: 'Sliding-window tracking',       ours: '✅ Count-based',      alt1: '✅ Count-based' },
      { feature: 'Half-open probing',             ours: '✅',                  alt1: '✅' },
      { feature: 'getMetrics()',                   ours: '✅ failureRate, totalCalls', alt1: '✅ stats object' },
      { feature: 'onStateChange hook',            ours: '✅ + metrics snapshot', alt1: '✅ events' },
      { feature: 'Result<T,E> integration',       ours: '✅ Native',           alt1: '❌ Throws / callbacks' },
      { feature: 'NestJS decorator',              ours: '✅ @UseCircuitBreaker', alt1: '❌ Manual wiring' },
      { feature: 'AbortController support',       ours: '❌',                  alt1: '✅' },
      { feature: 'Runtime dependencies',          ours: '0 (core)',            alt1: '0' },
      { feature: 'Weekly downloads',              ours: 'Growing',             alt1: '~2.2M' },
    ],
  },
  bulkhead: {
    intro: 'Comparing against p-limit and bottleneck — the most common concurrency-limiting libraries in Node.js.',
    ours: '@backendkit-labs/bulkhead',
    alternatives: ['p-limit', 'bottleneck'],
    rows: [
      { feature: 'Concurrency limit',          ours: '✅', alt1: '✅', alt2: '✅' },
      { feature: 'Wait queue',                 ours: '✅ maxQueue + rejection', alt1: '✅ Unlimited', alt2: '✅ Advanced' },
      { feature: 'Explicit queue rejection',   ours: '✅ fail(bulkhead_full)', alt1: '❌ Never rejects', alt2: '⚠️ via options' },
      { feature: 'Result<T,E> integration',    ours: '✅ Native',     alt1: '❌ Returns promise', alt2: '❌ Callbacks' },
      { feature: 'NestJS decorator',           ours: '✅ @UseBulkhead', alt1: '❌', alt2: '❌' },
      { feature: 'Named instances (registry)', ours: '✅',            alt1: '❌', alt2: '❌' },
      { feature: 'Rate limiting',              ours: '❌',            alt1: '❌', alt2: '✅' },
      { feature: 'Zero runtime deps',          ours: '✅',            alt1: '✅', alt2: '❌' },
      { feature: 'Weekly downloads',           ours: 'Growing',       alt1: '~50M', alt2: '~1M' },
    ],
  },
  observability: {
    intro: 'Comparing against building your own observability stack from individual packages — which is what most teams do today.',
    ours: '@backendkit-labs/observability',
    alternatives: ['pino (alone)', 'Custom (winston + prom-client + OTel)'],
    rows: [
      { feature: 'Auto correlation ID',       ours: '✅ Zero config', alt1: '❌ Manual AsyncLocalStorage', alt2: '❌ Manual' },
      { feature: 'NestJS forRoot() module',   ours: '✅',            alt1: '❌',  alt2: '❌' },
      { feature: 'Prometheus /metrics',       ours: '✅ Built-in',   alt1: '❌',  alt2: '⚠️ Requires prom-client setup' },
      { feature: 'OpenTelemetry tracing',     ours: '✅ Built-in',   alt1: '❌',  alt2: '⚠️ Requires @opentelemetry/* setup' },
      { feature: '@WithMetrics decorator',    ours: '✅',            alt1: '❌',  alt2: '❌' },
      { feature: 'Structured JSON logging',   ours: '✅ Winston',    alt1: '✅ JSON', alt2: '✅ Depends' },
      { feature: 'Setup complexity',          ours: '✅ One import', alt1: '⚠️ Medium', alt2: '❌ High' },
      { feature: 'Runtime dependencies',      ours: '~5 (all bundled)', alt1: '0', alt2: '5–10+' },
    ],
  },
  pipeline: {
    intro: 'Comparing against fp-ts (functional programming) and building a custom chain with Promises.',
    ours: '@backendkit-labs/pipeline',
    alternatives: ['fp-ts', 'Custom chain'],
    rows: [
      { feature: 'TypeScript-first',          ours: '✅', alt1: '✅', alt2: '⚠️ Depends' },
      { feature: 'Result<T,E> integration',   ours: '✅ Native',      alt1: '⚠️ Different Either type', alt2: '❌' },
      { feature: 'Stop-on-first mode',        ours: '✅ Default',     alt1: '❌ Manual', alt2: '❌ Manual' },
      { feature: 'Collect-all mode',          ours: '✅ Built-in',    alt1: '❌ Manual', alt2: '❌ Manual' },
      { feature: 'Context enrichment',        ours: '✅ ok({ ...ctx, extra })', alt1: '❌', alt2: '❌' },
      { feature: 'NestJS integration',        ours: '✅',             alt1: '❌', alt2: '❌' },
      { feature: 'Learning curve',            ours: '✅ Low (OOP)',   alt1: '❌ High (FP concepts)', alt2: '⚠️ Medium' },
      { feature: 'Bundle size',               ours: '✅ Small',       alt1: '❌ Large (~50kB)', alt2: '✅ Small' },
    ],
  },
  'http-client': {
    intro: 'Comparing against axios and got — the two most popular HTTP clients in the Node.js ecosystem.',
    ours: '@backendkit-labs/http-client',
    alternatives: ['axios', 'got'],
    rows: [
      { feature: 'Result<T,E> responses',     ours: '✅ Always',      alt1: '❌ Throws AxiosError', alt2: '❌ Throws' },
      { feature: 'Built-in retry',            ours: '✅ Exponential backoff', alt1: '❌ Manual / plugin', alt2: '✅ Built-in' },
      { feature: 'Circuit breaker',           ours: '✅ Integrated',  alt1: '❌', alt2: '❌' },
      { feature: 'Typed error variants',      ours: '✅ timeout/network/http_error', alt1: '⚠️ Generic AxiosError', alt2: '⚠️ Partial' },
      { feature: 'No try/catch required',     ours: '✅',             alt1: '❌', alt2: '❌' },
      { feature: 'NestJS integration',        ours: '✅ @InjectHttpClient', alt1: '⚠️ @nestjs/axios', alt2: '❌' },
      { feature: 'Named instances (DI)',       ours: '✅',             alt1: '⚠️ Manual', alt2: '❌' },
      { feature: 'Runtime dependencies',      ours: 'axios (peer)',   alt1: '0 (is the dep)', alt2: '0' },
      { feature: 'Weekly downloads',          ours: 'Growing',        alt1: '~50M', alt2: '~2M' },
    ],
  },
  'request-scanner': {
    intro: 'Comparing against helmet (HTTP security headers) and express-validator — the most common security middleware in Express apps.',
    ours: '@backendkit-labs/request-scanner',
    alternatives: ['helmet', 'express-validator'],
    rows: [
      { feature: 'SQL injection detection',   ours: '✅ Pattern-based', alt1: '❌ Headers only', alt2: '❌ Schema only' },
      { feature: 'XSS detection',             ours: '✅ Body/query/headers', alt1: '✅ CSP headers', alt2: '❌' },
      { feature: 'SSRF detection',            ours: '✅',               alt1: '❌', alt2: '❌' },
      { feature: 'NoSQL injection',           ours: '✅',               alt1: '❌', alt2: '❌' },
      { feature: 'Command injection',         ours: '✅',               alt1: '❌', alt2: '❌' },
      { feature: 'Path traversal',            ours: '✅',               alt1: '❌', alt2: '❌' },
      { feature: 'Request body scanning',     ours: '✅',               alt1: '❌', alt2: '✅ Schema validation' },
      { feature: 'NestJS guard',              ours: '✅',               alt1: '❌', alt2: '❌' },
      { feature: 'Configurable severity',     ours: '✅ permissive/standard/strict', alt1: '❌', alt2: '❌' },
      { feature: 'Custom rules',              ours: '✅',               alt1: '❌', alt2: '⚠️ Custom validators' },
      { feature: 'Allow list',                ours: '✅ Per-path',      alt1: '❌', alt2: '❌' },
      { feature: 'Zero runtime deps',         ours: '✅',               alt1: '✅', alt2: '✅' },
    ],
  },
};


// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PackageDocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pkg = packageDocs.find((p) => p.slug === slug);
  if (!pkg) notFound();

  const page = docPages[slug];
  if (!page) notFound();

  const { content: Content, examples } = page;
  const comparison = comparisonData[slug];

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-[#475569] mb-8 font-mono">
        <Link href="/" className="hover:text-slate-600 dark:hover:text-[#94a3b8] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/docs/" className="hover:text-slate-600 dark:hover:text-[#94a3b8] transition-colors">Docs</Link>
        <span>/</span>
        <span className="text-slate-500 dark:text-[#64748b]">{pkg.name}</span>
      </div>

      {/* Package header */}
      <div className="flex items-start gap-4 mb-10 pb-10 border-b border-gray-200 dark:border-white/[0.06]">
        <PackageIcon abbr={pkg.icon} color={pkg.color} size={56} />
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight font-mono">{pkg.name}</h1>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded border"
              style={{ color: pkg.color, background: `${pkg.color}10`, borderColor: `${pkg.color}30` }}
            >
              v{pkg.version}
            </span>
          </div>
          <p className="mt-1 text-sm font-mono text-slate-500 dark:text-[#64748b]">{pkg.npmName}</p>
          <p className="mt-2 text-slate-600 dark:text-[#94a3b8] text-[15px] leading-relaxed max-w-lg">{pkg.tagline}</p>
        </div>
      </div>

      {/* Rendered content sections */}
      <Content color={pkg.color} />

      {/* Examples */}
      <section id="examples">
        <SectionHeading id="examples">Examples</SectionHeading>
        <P>From basic to production-grade — copy and adapt.</P>
        <ExamplesTabs examples={examples} color={pkg.color} />
      </section>

      {/* Comparison */}
      {comparison && (
        <section id="comparison">
          <SectionHeading id="comparison">⚖️ vs. Alternatives</SectionHeading>
          <ComparisonTable
            ours={comparison.ours}
            alternatives={comparison.alternatives}
            rows={comparison.rows}
            intro={comparison.intro}
          />
          <p className="text-xs text-slate-400 dark:text-[#475569] mt-3 italic">
            ✅ Supported &nbsp;·&nbsp; ❌ Not supported &nbsp;·&nbsp; ⚠️ Partial / workaround needed.
            Download counts are approximate weekly npm averages.
          </p>
        </section>
      )}

      {/* Footer nav */}
      <div className="mt-14 pt-8 border-t border-gray-200 dark:border-white/[0.06] flex flex-col sm:flex-row gap-3">
        <a
          href={`https://www.npmjs.com/package/${pkg.npmName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ background: `${pkg.color}15`, color: pkg.color, border: `1px solid ${pkg.color}25` }}
        >
          View on npm
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <a
          href="https://github.com/BackendKit-labs/backendkit-monorepo"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-slate-500 dark:text-[#64748b] hover:text-slate-700 dark:hover:text-[#94a3b8] transition-colors"
        >
          View source on GitHub
        </a>
      </div>
    </div>
  );
}
