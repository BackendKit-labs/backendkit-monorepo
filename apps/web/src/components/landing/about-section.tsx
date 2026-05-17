const facts = [
  {
    label: 'Origin',
    color: '#4f7eff',
    text: 'Built from real production problems — payment integrations, third-party API isolation, cascading failures under load. Not theoretical patterns.',
  },
  {
    label: 'Design principle',
    color: '#6d4aff',
    text: 'Packages designed to compose, not just coexist. Result, circuit breaker, retry, and pipeline share the same error model so they wire together without glue code.',
  },
  {
    label: 'The differentiator',
    color: '#4f7eff',
    text: 'auto-learning closes the feedback loop between observability and resilience config. Statistical analysis — percentiles, z-score — no external ML models required.',
  },
];

export default function AboutSection() {
  return (
    <section className="relative py-20 lg:py-28">
      {/* Section divider */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-transparent via-[#4f7eff]/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">

          {/* Left: narrative */}
          <div>
            <span className="inline-block text-xs font-mono text-[#4f7eff] uppercase tracking-widest mb-4">
              About
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight mb-6">
              Built from experience,<br />not from theory
            </h2>

            <div className="space-y-4 text-[#94a3b8] text-base leading-relaxed">
              <p>
                BackendKit started as internal utilities while working on Node.js backends that needed
                resilience under real production load — circuit breakers for payment integrations,
                bulkheads for third-party API isolation, typed errors to make failure visible across
                large codebases.
              </p>
              <p>
                The patterns worked. We open-sourced them so others don't have to wire the same
                pieces together from scratch — or discover the edge cases the hard way.
              </p>
              <p>
                The codebase is production-ready. The community around it is just getting started.
                That means your use cases, bug reports, and ideas have real weight here.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="https://github.com/BackendKit-labs/backendkit-monorepo/discussions"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] transition-all duration-200"
              >
                Share your use case
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </div>

          {/* Right: fact cards */}
          <div className="space-y-4">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="relative group rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] p-6 hover:border-gray-200 dark:hover:border-white/[0.12] transition-all duration-300 overflow-hidden"
              >
                {/* Top accent line */}
                <div
                  className="absolute top-0 left-6 right-6 h-px opacity-50 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${fact.color}, transparent)`,
                  }}
                />

                <span
                  className="inline-block text-[10px] font-mono font-semibold uppercase tracking-widest px-2 py-1 rounded-md mb-3"
                  style={{
                    color: fact.color,
                    background: `${fact.color}15`,
                    border: `1px solid ${fact.color}20`,
                  }}
                >
                  {fact.label}
                </span>
                <p className="text-sm text-[#94a3b8] leading-relaxed">{fact.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
