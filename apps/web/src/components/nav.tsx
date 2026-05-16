'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/theme-toggle';

function LogoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      fill="none"
      className="w-8 h-8 flex-shrink-0"
    >
      <rect width="40" height="40" rx="9" fill="url(#nav-grad)" />
      <defs>
        <linearGradient
          id="nav-grad"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#4f7eff" />
          <stop offset="100%" stopColor="#6d4aff" />
        </linearGradient>
      </defs>
      <text
        x="20"
        y="26"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', monospace"
        fontSize="14"
        fontWeight="800"
        fill="white"
        textAnchor="middle"
        letterSpacing="-0.5"
      >
        BK
      </text>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#05050a]/90 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.04)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <LogoIcon />
          <span className="font-semibold text-white text-sm tracking-tight group-hover:text-white/90 transition-colors">
            BackendKit Labs
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/docs/" className="nav-link text-sm font-medium">
            Docs
          </Link>
          <a href="#packages" className="nav-link text-sm font-medium">
            Packages
          </a>
          <a
            href="https://github.com/BackendKit-labs/backendkit-monorepo"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link text-sm font-medium flex items-center gap-1.5"
          >
            <GitHubIcon />
            <span>GitHub</span>
          </a>
          <a
            href="https://www.npmjs.com/search?q=%40backendkit-labs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-[#94a3b8] hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200"
          >
            <span className="text-red-400 font-semibold">npm</span>
            <span>@backendkit-labs</span>
          </a>
          <ThemeToggle />
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#05050a]/95 backdrop-blur-xl border-b border-white/[0.06] px-4 pb-4">
          <div className="flex flex-col gap-1 pt-2">
            <Link
              href="/docs/"
              onClick={() => setMenuOpen(false)}
              className="py-2 px-3 rounded-lg text-sm text-[#94a3b8] hover:text-white hover:bg-white/5 transition-colors"
            >
              Docs
            </Link>
            <a
              href="#packages"
              onClick={() => setMenuOpen(false)}
              className="py-2 px-3 rounded-lg text-sm text-[#94a3b8] hover:text-white hover:bg-white/5 transition-colors"
            >
              Packages
            </a>
            <a
              href="https://github.com/BackendKit-labs/backendkit-monorepo"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 rounded-lg text-sm text-[#94a3b8] hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <GitHubIcon />
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/search?q=%40backendkit-labs"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 rounded-lg text-sm text-[#94a3b8] hover:text-white hover:bg-white/5 transition-colors"
            >
              npm packages
            </a>
            <div className="py-1 px-1">
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
