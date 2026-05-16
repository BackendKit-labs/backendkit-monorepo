import Link from 'next/link';
import { packages } from '@/lib/packages';
import type { Metadata } from 'next';
import { highlight } from '@/lib/highlight';
import PackageIcon from '@/components/package-icon';

export const metadata: Metadata = {
  title: 'Introduction — BackendKit Labs',
  description:
    'BackendKit Labs is a production-grade open-source ecosystem for Node.js resilience, observability, security, and distributed systems.',
};

// ── UI helpers ────────────────────────────────────────────────────────────────

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight mb-4 scroll-mt-20"
    >
      {children}
    </h2>
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

function Divider() {
  return <div className="my-12 border-t border-gray-200 dark:border-white/[0.06]" />;
}

function CodeBlock({ code }: { code: string }) {
  const html = highlight(code);
  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#0d1117] my-5">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-[#161b22]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[11px] font-mono text-[#64748b]">example.ts</span>
      </div>
      <pre
        className="p-5 font-mono text-[13px] leading-[1.75] overflow-x-auto text-[#e2e8f0] whitespace-pre m-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const problems = [
  { icon: '💥', text: 'Cascading failures between microservices' },
  { icon: '🔒', text: 'Shared resource exhaustion under load' },
  { icon: '⏱️', text: 'Mass timeouts and total degradation' },
  { icon: '🔍', text: 'Lack of distributed traceability' },
  { icon: '🐛', text: 'Difficulty diagnosing complex errors' },
  { icon: '🛡️', text: 'Exposure to common input-layer attacks' },
  { icon: '🚦', text: 'No concurrency control on shared resources' },
  { icon: '👁️', text: 'Operations with zero visibility' },
];

const philosophy = [
  {
    title: 'Explicit over magic',
    desc: 'Clear, predictable, auditable code before opaque abstractions that are hard to maintain.',
    icon: '🔎',
  },
  {
    title: 'Resilient by default',
    desc: 'Resilience patterns are built in from the start — not bolted on as an afterthought.',
    icon: '🏗️',
  },
  {
    title: 'Integrated, not accumulated',
    desc: 'Libraries share conventions, types, and architecture — they are designed to work together.',
    icon: '🔗',
  },
  {
    title: 'Production-tested',
    desc: 'Every pattern comes from real experience in production systems, not isolated theory.',
    icon: '🚀',
  },
  {
    title: 'Quality over quantity',
    desc: 'Not many mediocre libraries, but a few excellent ones. Less is more.',
    icon: '⭐',
  },
];

const audience = [
  {
    title: 'Backend developers',
    desc: 'Who want to write more robust and maintainable software without reinventing the wheel.',
    icon: '👨‍💻',
  },
  {
    title: 'NestJS teams',
    desc: 'Looking for deep, natural NestJS integration with decorators, modules, and DI.',
    icon: '🏢',
  },
  {
    title: 'Software architects',
    desc: 'Designing fault-tolerant distributed platforms who need proven resilience patterns.',
    icon: '🏛️',
  },
  {
    title: 'Production-minded projects',
    desc: 'That need resilience, observability, and security without unnecessary complexity.',
    icon: '🎯',
  },
];

const quickstartCode = `import { ok, fail, type Result } from '@backendkit-labs/result';
import { CircuitBreaker } from '@backendkit-labs/circuit-breaker';
import { HttpClient } from '@backendkit-labs/http-client';

// One shared circuit breaker instance for the payment gateway
const breaker = new CircuitBreaker({
  name: 'stripe',
  failureThreshold: 40,   // open after 40 % infra failures
  cooldownMs: 30_000,
  // card_declined is a business error — it must NOT open the circuit
  isFailure: (err) => err.status >= 500 || err.type === 'network_error',
});

const stripe = new HttpClient({
  baseUrl: 'https://api.stripe.com/v1',
  timeout: 10_000,
  retry: { attempts: 2, baseDelay: 500 },
});

async function chargeCard(
  amountCents: number,
  paymentMethodId: string,
): Promise<Result<PaymentIntent, ChargeError>> {
  return breaker.execute(() =>
    stripe.post<PaymentIntent>('/payment_intents', {
      amount: amountCents,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
    }),
  );
}

// Caller — no try/catch, no surprise exceptions, no unknown error shapes
const result = await chargeCard(4999, 'pm_card_visa');

if (result.ok) {
  return { chargeId: result.value.id };
}

// TypeScript narrows the union — every case is explicit
switch (result.error.type) {
  case 'circuit_open':    throw new ServiceUnavailableException();
  case 'http_error':      throw new UnprocessableEntityException(result.error.body);
  case 'network_error':   throw new BadGatewayException();
}`;

const installCode = `# Install only what you need
npm install @backendkit-labs/result
npm install @backendkit-labs/circuit-breaker
npm install @backendkit-labs/bulkhead
npm install @backendkit-labs/pipeline

# With required peer deps
npm install @backendkit-labs/http-client axios
npm install @backendkit-labs/observability`;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-[#475569] mb-8 font-mono">
        <Link href="/" className="hover:text-slate-600 dark:hover:text-[#94a3b8] transition-colors">Home</Link>
        <span>/</span>
        <span className="text-slate-500 dark:text-[#64748b]">Docs</span>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="mb-12 pb-12 border-b border-gray-200 dark:border-white/[0.06]">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4f7eff]/10 border border-[#4f7eff]/20 text-[#4f7eff] text-[11px] font-mono tracking-wide mb-5">
          Open Source · TypeScript · Node.js
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-4 leading-tight">
          Years of backend experience,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4f7eff] to-[#6d4aff]">
            built into a resilience platform
          </span>
        </h1>
        <p className="text-slate-600 dark:text-[#94a3b8] text-[17px] leading-relaxed mb-6 max-w-2xl">
          BackendKit Labs is a production-grade open-source ecosystem of libraries focused on
          resilience, observability, operational security, and backend platform for Node.js,
          NestJS, and distributed systems.
        </p>
        <p className="text-slate-500 dark:text-[#64748b] text-[15px] leading-relaxed max-w-2xl">
          Not a simple collection of isolated utilities — a cohesive technical platform where every
          library works in concert to strengthen the reliability of microservices, APIs, and
          distributed architectures.
        </p>
        <div className="flex flex-wrap gap-3 mt-7">
          <Link
            href="#quickstart"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4f7eff] text-white text-sm font-medium hover:bg-[#4f7eff]/90 transition-colors"
          >
            Quick start
          </Link>
          <Link
            href="#packages"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-slate-600 dark:text-[#94a3b8] text-sm font-medium hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/[0.15] transition-colors"
          >
            Browse packages
          </Link>
          <a
            href="https://github.com/BackendKit-labs/backendkit-monorepo"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-slate-600 dark:text-[#94a3b8] text-sm font-medium hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/[0.15] transition-colors"
          >
            GitHub
            <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      {/* ── Why it was born ───────────────────────────────────────────────── */}
      <section id="why" className="mb-12">
        <H2 id="why">Why BackendKit was born</H2>
        <P>
          Building robust, resilient, and maintainable backend applications is hard — not because
          tools are missing, but because the Node.js ecosystem offers loose pieces that require
          experience to choose, integrate, and operate correctly in production.
        </P>
        <P>
          BackendKit Labs was born from a real need: a unified collection of libraries that solve
          the critical day-to-day problems of modern backend systems.
        </P>

        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          {problems.map((p) => (
            <div
              key={p.text}
              className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.05]"
            >
              <span className="text-lg flex-shrink-0 mt-0.5">{p.icon}</span>
              <span className="text-[14px] text-slate-600 dark:text-[#94a3b8] leading-snug">{p.text}</span>
            </div>
          ))}
        </div>

        <p className="text-slate-500 dark:text-[#64748b] text-[14px] mt-5 italic">
          The goal is not "having utilities" — it is building reliable systems.
        </p>
      </section>

      <Divider />

      {/* ── Philosophy ────────────────────────────────────────────────────── */}
      <section id="philosophy" className="mb-12">
        <H2 id="philosophy">Philosophy</H2>
        <P>
          Five principles guide every design decision across the entire ecosystem.
        </P>
        <div className="grid gap-4 mt-6">
          {philosophy.map((p) => (
            <div
              key={p.title}
              className="flex items-start gap-4 p-5 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06]"
            >
              <span className="text-2xl flex-shrink-0">{p.icon}</span>
              <div>
                <div className="text-[15px] font-semibold text-gray-900 dark:text-white mb-1">{p.title}</div>
                <div className="text-[14px] text-slate-500 dark:text-[#64748b] leading-relaxed">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* ── Quick start ───────────────────────────────────────────────────── */}
      <section id="quickstart" className="mb-12">
        <H2 id="quickstart">Quick start</H2>
        <P>
          The fastest way to see BackendKit in action: a resilient payment charge that combines{' '}
          <C>result</C>, <C>circuit-breaker</C>, and <C>http-client</C> in under 40 lines — with
          zero <C>try/catch</C> and every error case typed and explicit at the call site.
        </P>
        <CodeBlock code={quickstartCode} />
      </section>

      <Divider />

      {/* ── Installation ──────────────────────────────────────────────────── */}
      <section id="installation" className="mb-12">
        <H2 id="installation">Installation</H2>
        <P>
          All packages are published under the <C>@backendkit-labs</C> scope on npm. Install only
          what you need — each package has a zero-dependency core.
        </P>
        <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.08] bg-[#0d1117]">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-[#161b22]">
            <span className="text-[11px] font-mono text-[#64748b]">terminal</span>
          </div>
          <pre className="p-5 font-mono text-[13px] leading-[1.75] overflow-x-auto text-[#94a3b8] whitespace-pre m-0">
            {installCode}
          </pre>
        </div>
        <p className="text-[13px] text-slate-400 dark:text-[#475569] mt-3">
          NestJS integration is available via <C>/nestjs</C> subpath exports on every package that
          supports it. No extra packages needed.
        </p>
      </section>

      <Divider />

      {/* ── Packages ──────────────────────────────────────────────────────── */}
      <section id="packages" className="mb-12">
        <H2 id="packages">What's included</H2>
        <P>
          Eight production-ready packages, each solving a distinct problem — and designed to
          compose naturally with each other.
        </P>
        <div className="grid gap-3 mt-6">
          {packages.map((pkg) => (
            <Link
              key={pkg.slug}
              href={`/docs/${pkg.slug}/`}
              className="flex items-start gap-4 p-5 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.12] hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all duration-200 group"
            >
              <PackageIcon abbr={pkg.icon} color={pkg.color} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className="font-mono text-[13px] font-semibold group-hover:brightness-110 transition-all"
                    style={{ color: pkg.color }}
                  >
                    {pkg.npmName}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-[#475569]">v{pkg.version}</span>
                </div>
                <p className="text-[14px] text-slate-500 dark:text-[#64748b] leading-snug">{pkg.longDescription}</p>
              </div>
              <svg
                className="w-4 h-4 text-slate-300 dark:text-[#334155] group-hover:text-slate-500 dark:group-hover:text-[#64748b] flex-shrink-0 mt-1 transition-colors"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      <Divider />

      {/* ── The differential ──────────────────────────────────────────────── */}
      <section id="differential" className="mb-12">
        <H2 id="differential">The real differential</H2>
        <P>
          The true difference is not in any individual library.
        </P>
        <P>
          It is that <strong className="text-gray-900 dark:text-white">they work as an ecosystem.</strong>
        </P>
        <div className="my-7 p-6 rounded-2xl bg-gradient-to-br from-[#4f7eff]/[0.08] to-[#6d4aff]/[0.05] border border-[#4f7eff]/20">
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { label: 'Circuit Breaker', color: '#f97316' },
              { label: 'Bulkhead',        color: '#10b981' },
              { label: 'Observability',   color: '#8b5cf6' },
              { label: 'Request Scanner', color: '#ef4444' },
              { label: 'Result',          color: '#4f7eff' },
              { label: 'Pipeline',        color: '#06b6d4' },
              { label: 'HTTP Client',     color: '#f59e0b' },
            ].map((b) => (
              <span
                key={b.label}
                className="text-[11px] font-mono px-2.5 py-1 rounded-full border"
                style={{ color: b.color, background: `${b.color}12`, borderColor: `${b.color}30` }}
              >
                {b.label}
              </span>
            ))}
          </div>
          <p className="text-[15px] text-slate-700 dark:text-[#94a3b8] leading-relaxed">
            These are not isolated pieces — they are a complete strategy for building serious
            backends. That turns libraries into a{' '}
            <span className="text-gray-900 dark:text-white font-medium">platform</span>. That turns utilities into{' '}
            <span className="text-gray-900 dark:text-white font-medium">architecture</span>.
          </p>
        </div>
      </section>

      <Divider />

      {/* ── For whom ──────────────────────────────────────────────────────── */}
      <section id="for-whom" className="mb-12">
        <H2 id="for-whom">Who it's for</H2>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          {audience.map((a) => (
            <div
              key={a.title}
              className="p-5 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06]"
            >
              <div className="text-2xl mb-3">{a.icon}</div>
              <div className="text-[15px] font-semibold text-gray-900 dark:text-white mb-1.5">{a.title}</div>
              <div className="text-[14px] text-slate-500 dark:text-[#64748b] leading-relaxed">{a.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* ── Current state ─────────────────────────────────────────────────── */}
      <section id="state" className="mb-12">
        <H2 id="state">Current state</H2>
        <P>
          Libraries are at initial versions and are targeting real production use. The goal is not
          simply to publish packages — it is to build a solid reference for modern backend architecture.
        </P>
        <div className="grid sm:grid-cols-3 gap-4 mt-5">
          {[
            { label: 'Maintainability', icon: '🔧' },
            { label: 'Security',        icon: '🔒' },
            { label: 'Observability',   icon: '📡' },
            { label: 'Resilience',      icon: '🏗️' },
            { label: 'Scalability',     icon: '📈' },
            { label: 'Operational responsibility', icon: '⚙️' },
          ].map((p) => (
            <div
              key={p.label}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.05]"
            >
              <span>{p.icon}</span>
              <span className="text-[13px] text-slate-500 dark:text-[#64748b]">{p.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <div className="mt-2 mb-10 p-8 rounded-2xl bg-gradient-to-br from-[#0d1117] to-[#0a0a12] border border-white/[0.08] text-center">
        <p className="text-[28px] font-bold text-white tracking-tight mb-2">
          If you build backend,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4f7eff] to-[#6d4aff]">
            build with BackendKit.
          </span>
        </p>
        <p className="text-[#64748b] text-[14px] mb-6">
          Created by Mairon José Cuello Martínez — turning years of distributed backend
          experience into reusable, consistent, production-ready tools.
        </p>
        <div className="flex justify-center flex-wrap gap-3">
          <Link
            href="/docs/result/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4f7eff] text-white text-sm font-medium hover:bg-[#4f7eff]/90 transition-colors"
          >
            Start with result →
          </Link>
          <a
            href="https://github.com/BackendKit-labs/backendkit-monorepo"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#94a3b8] text-sm font-medium hover:text-white transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
