'use client';

import { packages } from '@/lib/packages';
import PackageIcon from '@/components/package-icon';

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

function PackageCard({ pkg }: { pkg: (typeof packages)[0] }) {
  const installCmd = `npm install ${pkg.npmName}`;

  return (
    <div className="package-card group relative rounded-2xl bg-white dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] p-6 hover:border-gray-200 dark:hover:border-white/[0.12] transition-all duration-300 flex flex-col gap-4 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{
          background: `radial-gradient(ellipse at 0% 0%, ${pkg.color}08, transparent 60%)`,
        }}
      />

      {/* Top accent line */}
      <div
        className="absolute top-0 left-6 right-6 h-px opacity-0 group-hover:opacity-60 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${pkg.color}, transparent)` }}
      />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <PackageIcon abbr={pkg.icon} color={pkg.color} size={40} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm font-mono">{pkg.name}</h3>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-md border"
                style={{
                  color: pkg.color,
                  background: `${pkg.color}10`,
                  borderColor: `${pkg.color}25`,
                }}
              >
                v{pkg.version}
              </span>
            </div>
            <div className="text-[10px] text-[#64748b] font-mono mt-0.5 truncate max-w-[160px]">
              {pkg.npmName}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-[#94a3b8] leading-relaxed flex-1">{pkg.description}</p>

      {/* Highlights */}
      <div className="flex flex-wrap gap-1.5">
        {pkg.highlights.map((h) => (
          <span
            key={h}
            className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] text-[#64748b]"
          >
            {h}
          </span>
        ))}
      </div>

      {/* Install command */}
      <div className="relative group/copy">
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0d1117] border border-white/[0.06] font-mono text-xs">
          <span className="text-[#94a3b8] truncate">
            <span className="text-[#64748b]">$</span>{' '}
            <span className="text-[#e2e8f0]">npm install</span>{' '}
            <span style={{ color: pkg.color }}>{pkg.npmName}</span>
          </span>
          <button
            onClick={() => navigator.clipboard?.writeText(installCmd)}
            className="flex-shrink-0 text-[#475569] hover:text-[#94a3b8] transition-colors opacity-0 group/copy:opacity-100 focus:opacity-100"
            title="Copy to clipboard"
            aria-label="Copy install command"
          >
            <CopyIcon />
          </button>
        </div>
      </div>

      {/* Explore link */}
      <a
        href={`https://www.npmjs.com/package/${pkg.npmName}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-medium transition-all duration-200 w-fit"
        style={{ color: pkg.color }}
      >
        Explore
        <span className="transition-transform group-hover:translate-x-0.5">
          <ArrowIcon />
        </span>
      </a>
    </div>
  );
}

export default function PackagesGrid() {
  return (
    <section id="packages" className="relative py-20 lg:py-28">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#4f7eff]/[0.02] to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="inline-block text-xs font-mono text-[#4f7eff] uppercase tracking-widest mb-3">
            Packages
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            Pick what you need
          </h2>
          <p className="mt-3 text-[#64748b] text-base max-w-lg mx-auto">
            Seven focused packages. Install only what you need — no bundled bloat.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-5 max-w-5xl mx-auto">
          {/* First row: 3 packages */}
          <div className="sm:col-span-2 xl:col-span-2 grid sm:grid-cols-3 gap-5">
            {packages.slice(0, 3).map((pkg) => (
              <PackageCard key={pkg.slug} pkg={pkg} />
            ))}
          </div>
          {/* Second row: 2 packages */}
          <div className="sm:col-span-2 xl:col-span-2 grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto w-full">
            {packages.slice(3, 5).map((pkg) => (
              <PackageCard key={pkg.slug} pkg={pkg} />
            ))}
          </div>
          {/* Third row: 2 packages */}
          <div className="sm:col-span-2 xl:col-span-2 grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto w-full">
            {packages.slice(5, 7).map((pkg) => (
              <PackageCard key={pkg.slug} pkg={pkg} />
            ))}
          </div>
        </div>

        {/* Bottom link */}
        <div className="text-center mt-10">
          <a
            href="https://www.npmjs.com/search?q=%40backendkit-labs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            View all on npm
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
