const features = [
  {
    icon: '🎯',
    title: 'Composable over monolithic',
    description:
      'Each package solves one problem and solves it well. Mix and match freely — use result without circuit-breaker, or wire the full stack. No hidden coupling.',
    tag: 'Modular',
    color: '#4f7eff',
  },
  {
    icon: '🔌',
    title: 'Framework-agnostic core',
    description:
      'Zero-dependency core packages work in any Node.js project. Optional NestJS bindings live in /nestjs subpath exports — import only what you actually use.',
    tag: 'Universal',
    color: '#6d4aff',
  },
  {
    icon: '⚡',
    title: 'Types first',
    description:
      "The type system guides you toward correct usage. Errors are values in function signatures — not surprises at runtime. If it compiles, it's explicit.",
    tag: 'TypeScript',
    color: '#4f7eff',
  },
];

export default function Features() {
  return (
    <section className="relative py-20 lg:py-28">
      {/* Section divider */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-transparent via-[#4f7eff]/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section label */}
        <div className="text-center mb-14">
          <span className="inline-block text-xs font-mono text-[#4f7eff] uppercase tracking-widest mb-3">
            Philosophy
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            Designed with intent
          </h2>
          <p className="mt-3 text-[#64748b] text-base max-w-lg mx-auto">
            Three principles that guide every decision in the BackendKit ecosystem.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="relative group rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] p-8 hover:border-gray-200 dark:hover:border-white/[0.12] hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-all duration-300 overflow-hidden"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {/* Background glow on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at 30% 30%, ${feature.color}08, transparent 70%)`,
                }}
              />

              {/* Top gradient line */}
              <div
                className="absolute top-0 left-8 right-8 h-px opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `linear-gradient(90deg, transparent, ${feature.color}, transparent)`,
                }}
              />

              {/* Icon */}
              <div className="relative mb-5">
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl text-xl"
                  style={{ background: `${feature.color}15`, border: `1px solid ${feature.color}25` }}
                >
                  {feature.icon}
                </div>
              </div>

              {/* Tag */}
              <div className="mb-3">
                <span
                  className="text-[10px] font-mono font-semibold uppercase tracking-widest px-2 py-1 rounded-md"
                  style={{
                    color: feature.color,
                    background: `${feature.color}15`,
                    border: `1px solid ${feature.color}20`,
                  }}
                >
                  {feature.tag}
                </span>
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 leading-snug">
                {feature.title}
              </h3>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
