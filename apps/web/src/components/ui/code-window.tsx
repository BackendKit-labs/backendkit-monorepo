'use client';

import { useState } from 'react';

interface CodeWindowProps {
  filename: string;
  highlightedCode: string;
  plainCode: string;
}

export function CodeWindow({ filename, highlightedCode, plainCode }: CodeWindowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(plainCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#0d1117] shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-[#161b22]">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] font-mono text-[#64748b]">{filename}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md border border-white/[0.06] transition-all duration-200"
          style={{
            color: copied ? '#28c840' : '#475569',
            borderColor: copied ? 'rgba(40,200,64,0.3)' : undefined,
          }}
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Copied
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
      </div>

      {/* Code */}
      <pre
        className="p-5 font-mono text-[13px] leading-[1.75] overflow-x-auto text-[#e2e8f0] min-h-[200px] whitespace-pre m-0"
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    </div>
  );
}
