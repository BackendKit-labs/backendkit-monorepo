'use client';

import { useState } from 'react';

// Syntax token helpers
const T = {
  kw: (t: string) => `<span class="text-[#ff7b72]">${t}</span>`,
  str: (t: string) => `<span class="text-[#a5d6ff]">${t}</span>`,
  fn: (t: string) => `<span class="text-[#d2a8ff]">${t}</span>`,
  ty: (t: string) => `<span class="text-[#79c0ff]">${t}</span>`,
  cmt: (t: string) => `<span class="text-[#8b949e] italic">${t}</span>`,
  op: (t: string) => `<span class="text-[#8b949e]">${t}</span>`,
  num: (t: string) => `<span class="text-[#f2cc60]">${t}</span>`,
  va: (t: string) => `<span class="text-[#e2e8f0]">${t}</span>`,
  dec: (t: string) => `<span class="text-[#d2a8ff]">${t}</span>`,
  prop: (t: string) => `<span class="text-[#79c0ff]">${t}</span>`,
};

const basicUsageCode = `${T.cmt('// Type-safe errors — no exceptions')}
${T.kw('import')} ${T.op('{')} ${T.va('ok')}, ${T.va('fail')}, ${T.kw('type')} ${T.ty('Result')} ${T.op('}')} ${T.kw('from')} ${T.str("'@backendkit-labs/result'")};

${T.kw('async function')} ${T.fn('getUser')}(${T.va('id')}: ${T.ty('string')}): ${T.ty('Promise')}<${T.ty('Result')}<${T.ty('User')}, ${T.ty('AppError')}>> {
  ${T.kw('const')} ${T.va('user')} = ${T.kw('await')} ${T.va('db')}.${T.va('users')}.${T.fn('findById')}(${T.va('id')});
  ${T.kw('if')} (${T.op('!')}${T.va('user')}) ${T.kw('return')} ${T.fn('fail')}({ ${T.prop('type')}: ${T.str("'not_found'")}, ${T.prop('id')} });
  ${T.kw('return')} ${T.fn('ok')}(${T.va('user')});
}

${T.kw('const')} ${T.va('result')} = ${T.kw('await')} ${T.fn('getUser')}(${T.str("'usr_123'")});

${T.kw('if')} (${T.va('result')}.${T.prop('ok')}) {
  ${T.va('console')}.${T.fn('log')}(${T.va('result')}.${T.prop('value')}.${T.prop('name')}); ${T.cmt('// User — TypeScript knows')}
} ${T.kw('else')} {
  ${T.va('console')}.${T.fn('error')}(${T.va('result')}.${T.prop('error')}.${T.prop('type')}); ${T.cmt("// 'not_found' — typed")}
}`;

const nestjsCode = `${T.cmt('// app.module.ts')}
${T.kw('import')} ${T.op('{')} ${T.ty('CircuitBreakerModule')} ${T.op('}')} ${T.kw('from')} ${T.str("'@backendkit-labs/circuit-breaker/nestjs'")};
${T.kw('import')} ${T.op('{')} ${T.ty('BulkheadModule')} ${T.op('}')}       ${T.kw('from')} ${T.str("'@backendkit-labs/bulkhead/nestjs'")};
${T.kw('import')} ${T.op('{')} ${T.ty('ObservabilityModule')} ${T.op('}')}  ${T.kw('from')} ${T.str("'@backendkit-labs/observability'")};

${T.dec('@Module')}${T.op('({')}
  ${T.prop('imports')}: ${T.op('[')}
    ${T.ty('ObservabilityModule')}.${T.fn('forRoot')}${T.op('(')}{ ${T.prop('serviceName')}: ${T.str("'api'")}, ${T.prop('environment')}: ${T.str("'production'")} }${T.op(')')}${T.op(',')}
    ${T.ty('CircuitBreakerModule')}${T.op(',')}
    ${T.ty('BulkheadModule')}${T.op(',')}
  ${T.op(']')},
${T.op('})')}
${T.kw('export class')} ${T.ty('AppModule')} ${T.op('{}')}

${T.cmt('// payment.service.ts')}
${T.dec('@Injectable')}${T.op('()')}
${T.kw('export class')} ${T.ty('PaymentService')} ${T.op('{')}
  ${T.kw('private readonly')} ${T.va('cb')} = ${T.kw('new')} ${T.ty('CircuitBreaker')}${T.op('(')}{ ${T.prop('name')}: ${T.str("'stripe'")}, ${T.prop('failureThreshold')}: ${T.num('40')} }${T.op(')')};

  ${T.dec('@WithMetrics')}${T.op('(')}{ ${T.prop('operation')}: ${T.str("'payment.charge'")} }${T.op(')')}
  ${T.kw('async')} ${T.fn('charge')}(${T.va('dto')}: ${T.ty('ChargeDto')}): ${T.ty('Promise')}<${T.ty('Result')}<${T.ty('Payment')}, ${T.ty('PaymentError')}>> {
    ${T.kw('return')} ${T.kw('this')}.${T.va('cb')}.${T.fn('execute')}${T.op('(')}() => ${T.kw('this')}.${T.va('stripe')}.${T.va('charges')}.${T.fn('create')}(${T.va('dto')})${T.op(')')};
  }
${T.op('}')}`;

const fullStackCode = `${T.cmt('// Full resilience stack: circuit breaker + bulkhead + retry + observability')}
${T.dec('@Injectable')}${T.op('()')}
${T.kw('export class')} ${T.ty('ExternalApiService')} ${T.op('{')}
  ${T.kw('constructor')}${T.op('(')}
    ${T.dec('@InjectHttpClient')}${T.op('(')}${T.ty('ApiToken')}${T.op(')')} ${T.kw('private readonly')} ${T.va('http')}: ${T.ty('HttpClient')},
  ${T.op(')')} {}

  ${T.dec('@UseCircuitBreaker')}${T.op('(')}${T.str("'external-api'")}${T.op(')')}
  ${T.dec('@UseBulkhead')}${T.op('(')}{ ${T.prop('name')}: ${T.str("'external-api'")}, ${T.prop('maxConcurrent')}: ${T.num('10')} }${T.op(')')}
  ${T.kw('async')} ${T.fn('fetchData')}(${T.va('id')}: ${T.ty('string')}): ${T.ty('Promise')}<${T.ty('Result')}<${T.ty('ApiResponse')}, ${T.ty('HttpClientError')}>> {
    ${T.kw('return')} ${T.kw('this')}.${T.va('http')}.${T.fn('get')}<${T.ty('ApiResponse')}>(\`${T.str('/data/')}${T.op('${')}${T.va('id')}${T.op('}')}\`, ${T.op('{')}
      ${T.prop('retry')}: { ${T.prop('attempts')}: ${T.num('3')}, ${T.prop('baseDelay')}: ${T.num('500')} },
    ${T.op('}')});
  }
${T.op('}')}`;

const tabs = [
  { id: 'basic', label: 'Basic usage', filename: 'user.service.ts', code: basicUsageCode },
  { id: 'nestjs', label: 'With NestJS', filename: 'app.module.ts', code: nestjsCode },
  { id: 'fullstack', label: 'Full stack', filename: 'external-api.service.ts', code: fullStackCode },
];

export default function CodeTabs() {
  const [activeTab, setActiveTab] = useState('basic');
  const current = tabs.find((t) => t.id === activeTab)!;

  return (
    <section className="relative py-20 lg:py-28">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#6d4aff]/[0.03] to-transparent pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-mono text-[#6d4aff] uppercase tracking-widest mb-3">
            Examples
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            From basic to production
          </h2>
          <p className="mt-3 text-[#64748b] text-base max-w-lg mx-auto">
            Start simple. Scale to the full resilience stack when you need it.
          </p>
        </div>

        {/* Code window */}
        <div className="rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d1117] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_32px_80px_rgba(0,0,0,0.6)]">
          {/* Window chrome + tabs */}
          <div className="flex items-center gap-0 border-b border-white/[0.06] bg-white/[0.02]">
            {/* Traffic lights */}
            <div className="flex items-center gap-1.5 px-4 py-3.5 border-r border-white/[0.06]">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>

            {/* Tabs */}
            <div className="flex items-end flex-1 px-2 pt-0 gap-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 py-3 text-xs font-medium transition-all duration-200 rounded-t-lg ${
                    activeTab === tab.id
                      ? 'text-white bg-[#161b22] border-t border-l border-r border-white/[0.08]'
                      : 'text-[#64748b] hover:text-[#94a3b8]'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-[#161b22]" />
                  )}
                </button>
              ))}
            </div>

            {/* Filename */}
            <div className="hidden sm:flex items-center px-4 py-3">
              <span className="text-[10px] font-mono text-[#475569]">{current.filename}</span>
            </div>
          </div>

          {/* Code area */}
          <div className="bg-[#161b22]">
            {/* Line numbers + code */}
            <div className="relative overflow-x-auto">
              <pre
                key={activeTab}
                className="tab-content p-6 font-mono text-[13px] leading-7 min-h-[280px] whitespace-pre m-0"
                dangerouslySetInnerHTML={{ __html: current.code }}
              />
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.04] bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-[#475569]">TypeScript</span>
              <span className="text-[10px] font-mono text-[#475569]">UTF-8</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#28c840]" />
              <span className="text-[10px] font-mono text-[#475569]">No errors</span>
            </div>
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center mt-6 text-xs text-[#475569] font-mono">
          All examples are fully typed · No <span className="text-[#ff7b72]">try</span>/
          <span className="text-[#ff7b72]">catch</span> blocks · Errors are values
        </p>
      </div>
    </section>
  );
}
