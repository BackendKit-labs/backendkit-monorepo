import Link from 'next/link';

function CodeLine({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`leading-7 ${className}`}>{children}</div>;
}

const kw = (text: string) => (
  <span className="text-[#ff7b72]">{text}</span>
);
const str = (text: string) => (
  <span className="text-[#a5d6ff]">{text}</span>
);
const fn = (text: string) => (
  <span className="text-[#d2a8ff]">{text}</span>
);
const ty = (text: string) => (
  <span className="text-[#79c0ff]">{text}</span>
);
const cmt = (text: string) => (
  <span className="text-[#8b949e] italic">{text}</span>
);
const op = (text: string) => (
  <span className="text-[#8b949e]">{text}</span>
);
const num = (text: string) => (
  <span className="text-[#f2cc60]">{text}</span>
);
const va = (text: string) => (
  <span className="text-[#e2e8f0]">{text}</span>
);

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#4f7eff]/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-[#6d4aff]/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: text */}
          <div className="flex flex-col gap-6">
            {/* Badge */}
            <div className="animate-fade-in-up">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#4f7eff]/10 border border-[#4f7eff]/20 text-[#7da4ff]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-[#4f7eff] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4f7eff]" />
                </span>
                10 packages · Apache-2.0 · TypeScript-first
              </span>
            </div>

            {/* Heading */}
            <div className="animate-fade-in-up stagger-1">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                <span className="text-gray-900 dark:text-white">The missing toolkit</span>
                <br />
                <span
                  style={{
                    background: 'linear-gradient(135deg, #4f7eff, #6d4aff)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  for production backends
                </span>
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-[#94a3b8] text-lg leading-relaxed max-w-lg animate-fade-in-up stagger-2">
              Composable building blocks for resilient Node.js backends — built from production experience with distributed systems.
              Framework-agnostic cores with optional NestJS integration and adaptive auto-tuning.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 animate-fade-in-up stagger-3">
              <Link
                href="/docs/"
                className="btn-gradient inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white shadow-[0_0_24px_rgba(79,126,255,0.3)]"
              >
                Get Started
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="https://github.com/BackendKit-labs/backendkit-monorepo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-gray-800 dark:text-white bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                View on GitHub
              </a>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-6 pt-2 animate-fade-in-up stagger-4">
              {[
                { value: '10', label: 'packages' },
                { value: '0', label: 'runtime deps (core)' },
                { value: '100%', label: 'TypeScript' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col">
                  <span
                    className="text-2xl font-bold"
                    style={{
                      background: 'linear-gradient(135deg, #4f7eff, #6d4aff)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {stat.value}
                  </span>
                  <span className="text-xs text-[#64748b] mt-0.5">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: code block */}
          <div className="animate-fade-in-up stagger-2">
            <div className="relative">
              {/* Glow behind code */}
              <div className="absolute -inset-4 bg-[#4f7eff]/5 rounded-2xl blur-xl pointer-events-none" />

              <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d1117] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_32px_64px_rgba(0,0,0,0.5)]">
                {/* Window chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-[10px] font-mono text-[#64748b]">payment.service.ts</span>
                  </div>
                </div>

                {/* Code */}
                <div className="p-5 font-mono text-[13px] leading-7 overflow-x-auto">
                  <CodeLine>
                    {kw('import')} {op('{')} {va('ok')}, {va('fail')} {op('}')} {kw('from')} {str("'@backendkit-labs/result'")}
                    {op(';')}
                  </CodeLine>
                  <CodeLine>
                    {kw('import')} {op('{')} {ty('CircuitBreaker')} {op('}')} {kw('from')} {str("'@backendkit-labs/circuit-breaker'")}
                    {op(';')}
                  </CodeLine>
                  <CodeLine>&nbsp;</CodeLine>
                  <CodeLine>
                    {kw('const')} {va('cb')} {op('=')} {kw('new')} {ty('CircuitBreaker')}
                    {op('(')} {op('{')}
                  </CodeLine>
                  <CodeLine className="pl-6">
                    {va('name')}{op(':')} {str("'stripe'")}{op(',')} {va('failureThreshold')}{op(':')} {num('40')}
                  </CodeLine>
                  <CodeLine>{op('}')} {op(')')}{op(';')}</CodeLine>
                  <CodeLine>&nbsp;</CodeLine>
                  <CodeLine>
                    {kw('const')} {va('result')} {op('=')} {kw('await')} {va('cb')}{op('.')}{fn('execute')}
                    {op('(')} {op('()')} {op('=>')} {va('stripe')}{op('.')}{va('charges')}{op('.')}{fn('create')}
                    {op('(')}
                    {va('dto')}{op(')')} {op(')')}{op(';')}
                  </CodeLine>
                  <CodeLine>&nbsp;</CodeLine>
                  <CodeLine>
                    {kw('if')} {op('(')}
                    {va('result')}{op('.')}
                    {va('ok')}{op(')')} {op('{')}
                  </CodeLine>
                  <CodeLine className="pl-6">
                    {kw('return')} {va('result')}{op('.')}
                    {va('value')}{op(';')}{' '}
                    {cmt('// Payment')}
                  </CodeLine>
                  <CodeLine>{op('}')}</CodeLine>
                  <CodeLine>
                    {cmt('// result.error is typed — no try/catch needed')}
                  </CodeLine>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-3 -right-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0d1117] border border-white/10 shadow-xl">
                <div className="w-2 h-2 rounded-full bg-[#28c840] shadow-[0_0_6px_#28c840]" />
                <span className="text-xs font-mono text-[#94a3b8]">result.ok === true</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#05050a] to-transparent pointer-events-none" />
    </section>
  );
}
