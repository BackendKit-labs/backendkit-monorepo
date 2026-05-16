'use client';

import { useState } from 'react';

const installCommands = [
  { pkg: 'result', cmd: 'npm install @backendkit-labs/result' },
  { pkg: 'circuit-breaker', cmd: 'npm install @backendkit-labs/circuit-breaker' },
  { pkg: 'http-client', cmd: 'npm install @backendkit-labs/http-client axios' },
];

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
        copied
          ? 'bg-[#28c840]/20 text-[#28c840] border border-[#28c840]/30'
          : 'bg-white/[0.05] text-[#64748b] border border-white/[0.08] hover:text-white hover:bg-white/[0.1]'
      }`}
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <>
          <CheckIcon />
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

export default function InstallSection() {
  const allCommands = installCommands.map((c) => c.cmd).join('\n');

  return (
    <section className="relative py-20 lg:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main card */}
        <div className="relative rounded-2xl overflow-hidden">
          {/* Gradient border */}
          <div className="absolute inset-0 rounded-2xl p-px bg-gradient-to-br from-[#4f7eff]/40 via-[#6d4aff]/20 to-transparent">
            <div className="absolute inset-0 rounded-2xl bg-[#0d1117]" />
          </div>

          {/* Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#4f7eff]/[0.06] to-[#6d4aff]/[0.04] rounded-2xl pointer-events-none" />

          <div className="relative p-8 md:p-10">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <span className="inline-block text-xs font-mono text-[#4f7eff] uppercase tracking-widest mb-2">
                  Install
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Start in seconds
                </h2>
                <p className="mt-2 text-sm text-[#64748b]">
                  Install only what you need. Each package is independent.
                </p>
              </div>
              <CopyButton text={allCommands} />
            </div>

            {/* Command blocks */}
            <div className="space-y-2">
              {/* Comment line */}
              <div className="px-4 py-1 font-mono text-xs text-[#8b949e] italic">
                # Install what you need
              </div>

              {installCommands.map(({ pkg, cmd }) => (
                <div
                  key={pkg}
                  className="group flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.05] transition-all duration-200"
                >
                  <div className="font-mono text-sm text-[#e2e8f0] truncate">
                    <span className="text-[#64748b] mr-2">$</span>
                    <span className="text-[#94a3b8]">npm install </span>
                    <span className="text-[#4f7eff]">
                      {cmd.replace('npm install ', '').split(' ')[0]}
                    </span>
                    {cmd.includes(' axios') && (
                      <span className="text-[#94a3b8]"> axios</span>
                    )}
                  </div>
                  <CopyButton text={cmd} />
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-white/[0.06]" />

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2">
              {[
                '✓ Tree-shakeable',
                '✓ ESM + CJS',
                '✓ Node 18+',
                '✓ TypeScript 5.x',
                '✓ Zero runtime deps (core)',
              ].map((item) => (
                <span
                  key={item}
                  className="text-xs px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[#64748b]"
                >
                  {item}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="https://github.com/BackendKit-labs/backendkit-monorepo"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gradient inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                View on GitHub
              </a>
              <a
                href="/docs/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] transition-all duration-200"
              >
                Read the docs
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
