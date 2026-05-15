'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { packageDocs } from '@/lib/package-docs';
import { highlight } from '@/lib/highlight';
import { CodeWindow } from '@/components/ui/code-window';
import PackageIcon from '@/components/package-icon';

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
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

function ExternalIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function InstallBlock({ npmName, color }: { npmName: string; color: string }) {
  const [copied, setCopied] = useState(false);
  const cmd = `npm install ${npmName}`;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#0d1117] border border-white/[0.06] font-mono text-[13px]">
      <span className="text-[#94a3b8] truncate">
        <span className="text-[#64748b]">$</span>{' '}
        <span className="text-[#e2e8f0]">npm install</span>{' '}
        <span style={{ color }}>{npmName}</span>
      </span>
      <button
        onClick={async () => {
          await navigator.clipboard?.writeText(cmd);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="flex-shrink-0 flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md border border-white/[0.06] transition-all duration-200"
        style={{ color: copied ? '#28c840' : '#475569', borderColor: copied ? 'rgba(40,200,64,0.3)' : undefined }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function LibraryShowcase() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeTab, setActiveTab] = useState(0);

  // Pre-highlight all examples once (memoized)
  const highlighted = useMemo(
    () =>
      packageDocs.map((pkg) =>
        pkg.examples.map((ex) => ({
          ...ex,
          highlightedCode: highlight(ex.code),
        })),
      ),
    [],
  );

  const pkg = packageDocs[activeIdx];
  const examples = highlighted[activeIdx];
  const example = examples[activeTab];

  const handleSelect = (i: number) => {
    setActiveIdx(i);
    setActiveTab(0);
  };

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
            Explore the libraries
          </h2>
          <p className="mt-3 text-[#64748b] text-base max-w-lg mx-auto">
            Seven focused packages. Install only what you need — no bundled bloat.
          </p>
        </div>

        {/* Main showcase panel */}
        <div className="rounded-2xl border border-white/[0.08] dark:border-white/[0.08] border-gray-200 overflow-hidden bg-white dark:bg-[#0d1117] shadow-[0_2px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_2px_32px_rgba(0,0,0,0.5)]">
          <div className="flex flex-col lg:flex-row min-h-[640px]">

            {/* ── Left: Package list ── */}
            <div className="lg:w-[260px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.06] dark:border-white/[0.06] border-gray-200 overflow-x-auto lg:overflow-x-visible">
              {/* Mobile: horizontal scroll */}
              <div className="flex lg:flex-col gap-0">
                {packageDocs.map((p, i) => {
                  const isActive = i === activeIdx;
                  return (
                    <button
                      key={p.slug}
                      onClick={() => handleSelect(i)}
                      className={`relative flex items-center gap-3 px-5 py-4 text-left transition-all duration-200 flex-shrink-0 lg:flex-shrink lg:w-full border-b border-white/[0.04] dark:border-white/[0.04] border-gray-100 last:border-b-0
                        ${isActive
                          ? 'bg-white/[0.04] dark:bg-white/[0.04] bg-gray-50'
                          : 'hover:bg-white/[0.02] dark:hover:bg-white/[0.02] hover:bg-gray-50/50'
                        }`}
                    >
                      {/* Active accent bar */}
                      {isActive && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
                          style={{ background: p.color }}
                        />
                      )}

                      <PackageIcon abbr={p.icon} color={p.color} size={32} />

                      <div className="min-w-0 hidden lg:block">
                        <div
                          className="text-sm font-semibold font-mono truncate transition-colors"
                          style={{ color: isActive ? p.color : undefined }}
                        >
                          {!isActive && <span className="text-gray-600 dark:text-[#64748b]">{p.name}</span>}
                          {isActive && p.name}
                        </div>
                        <div className="text-[11px] text-[#64748b] truncate mt-0.5">{p.tagline}</div>
                      </div>

                      {/* Mobile: just icon (visible via flex-shrink-0 above) */}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Right: Detail panel ── */}
            <div className="flex-1 flex flex-col p-6 lg:p-8 gap-6 overflow-hidden">

              {/* Package header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <PackageIcon abbr={pkg.icon} color={pkg.color} size={48} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold font-mono text-gray-900 dark:text-white">{pkg.name}</h3>
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                        style={{
                          color: pkg.color,
                          background: `${pkg.color}10`,
                          borderColor: `${pkg.color}30`,
                        }}
                      >
                        v{pkg.version}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748b] font-mono mt-0.5">{pkg.npmName}</div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-[#94a3b8] leading-relaxed">{pkg.description}</p>

              {/* Install command */}
              <InstallBlock npmName={pkg.npmName} color={pkg.color} />

              {/* Features + Code — two column on large screens */}
              <div className="grid lg:grid-cols-[200px,1fr] gap-6 flex-1 min-h-0">

                {/* Features */}
                <div className="flex flex-col gap-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#475569]">
                    Features
                  </div>
                  <ul className="space-y-2.5">
                    {pkg.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm text-gray-700 dark:text-[#94a3b8]">
                        <span style={{ color: pkg.color }} className="mt-0.5">
                          <CheckIcon />
                        </span>
                        {h}
                      </li>
                    ))}
                  </ul>

                  {/* Links */}
                  <div className="mt-auto pt-4 flex flex-col gap-2">
                    <Link
                      href={`/docs/${pkg.slug}/`}
                      className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                      style={{ color: pkg.color }}
                    >
                      Read the docs
                      <ArrowIcon />
                    </Link>
                    <a
                      href={`https://www.npmjs.com/package/${pkg.npmName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors"
                    >
                      View on npm
                      <ExternalIcon />
                    </a>
                  </div>
                </div>

                {/* Code window */}
                <div className="flex flex-col gap-3 min-w-0">
                  {/* Tab bar */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {examples.map((ex, i) => (
                      <button
                        key={ex.label}
                        onClick={() => setActiveTab(i)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                          i === activeTab
                            ? 'text-white'
                            : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-white/[0.04]'
                        }`}
                        style={
                          i === activeTab
                            ? { background: `${pkg.color}20`, color: pkg.color }
                            : undefined
                        }
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>

                  {/* Code block */}
                  <CodeWindow
                    filename={example.filename}
                    highlightedCode={example.highlightedCode}
                    plainCode={example.code}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom link */}
        <div className="text-center mt-8">
          <a
            href="https://www.npmjs.com/search?q=%40backendkit-labs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            View all on npm
            <ExternalIcon />
          </a>
        </div>
      </div>
    </section>
  );
}
