import Link from 'next/link';

const steps = [
  {
    step: '01',
    label: 'Monitor',
    color: '#4f7eff',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    description: 'Records latency percentiles, error rates, and call frequency per endpoint in a sliding window — continuously, in the background.',
  },
  {
    step: '02',
    label: 'Detect',
    color: '#6d4aff',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.636 6.364l.707-.707M6.343 6.343l-.707-.707M12 21v-1m0-16a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    ),
    description: 'Z-score analysis and percentile thresholds flag latency spikes, error surges, and unknown traffic patterns before they cascade.',
  },
  {
    step: '03',
    label: 'Adjust',
    color: '#4f7eff',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
    description: 'Updates circuit breaker thresholds, bulkhead concurrency limits, and HTTP client timeouts automatically. No restart, no manual tuning.',
  },
];

const pills = [
  'No ML models required',
  'No cloud services',
  'Statistically deterministic',
  'Pluggable StorageAdapter',
];

function ArrowRight() {
  return (
    <div className="hidden lg:flex items-center justify-center flex-shrink-0 text-[#334155]">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
      </svg>
    </div>
  );
}

export default function AutoLearningSection() {
  return (
    <section className="relative py-20 lg:py-28 overflow-hidden">
      {/* Section divider */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-transparent via-[#4f7eff]/30 to-transparent" />

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#4f7eff]/[0.04] rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block text-xs font-mono text-[#4f7eff] uppercase tracking-widest mb-3">
            auto-learning
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-4">
            Your backend teaches itself<br className="hidden sm:block" /> to be resilient
          </h2>
          <p className="text-[#64748b] text-base max-w-xl mx-auto">
            Manual threshold tuning is guesswork. A timeout that works in staging breaks in production.
            <strong className="text-[#94a3b8] font-medium"> auto-learning </strong>
            closes the feedback loop automatically — no ML models, no cloud services.
          </p>
        </div>

        {/* Feedback loop */}
        <div className="flex flex-col lg:flex-row items-stretch gap-3 lg:gap-0 mb-12">
          {steps.map((step, i) => (
            <>
              <div
                key={step.label}
                className="relative flex-1 group rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] p-7 hover:border-gray-200 dark:hover:border-white/[0.12] transition-all duration-300 overflow-hidden"
              >
                {/* Top accent */}
                <div
                  className="absolute top-0 left-6 right-6 h-px opacity-50 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg, transparent, ${step.color}, transparent)` }}
                />

                {/* Step number */}
                <div className="flex items-center justify-between mb-5">
                  <div
                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl"
                    style={{ background: `${step.color}15`, border: `1px solid ${step.color}25`, color: step.color }}
                  >
                    {step.icon}
                  </div>
                  <span
                    className="text-xs font-mono font-bold"
                    style={{ color: `${step.color}60` }}
                  >
                    {step.step}
                  </span>
                </div>

                <span
                  className="inline-block text-[10px] font-mono font-semibold uppercase tracking-widest px-2 py-1 rounded-md mb-3"
                  style={{ color: step.color, background: `${step.color}15`, border: `1px solid ${step.color}20` }}
                >
                  {step.label}
                </span>
                <p className="text-sm text-[#94a3b8] leading-relaxed">{step.description}</p>
              </div>

              {i < steps.length - 1 && <ArrowRight key={`arrow-${i}`} />}
            </>
          ))}
        </div>

        {/* Loop indicator */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="h-px flex-1 max-w-24 bg-gradient-to-r from-transparent to-[#4f7eff]/30" />
          <span className="text-xs font-mono text-[#475569] px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02]">
            ↺ continuous loop — adapts as traffic changes
          </span>
          <div className="h-px flex-1 max-w-24 bg-gradient-to-l from-transparent to-[#4f7eff]/30" />
        </div>

        {/* Pills + CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {pills.map((pill) => (
              <span
                key={pill}
                className="text-xs px-3 py-1.5 rounded-full bg-[#4f7eff]/10 border border-[#4f7eff]/20 text-[#7da4ff] font-medium"
              >
                ✓ {pill}
              </span>
            ))}
          </div>
          <Link
            href="/packages/auto-learning"
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white btn-gradient whitespace-nowrap"
          >
            Explore Auto-Learning
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
