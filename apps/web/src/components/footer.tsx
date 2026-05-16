import Link from 'next/link';

function LogoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      fill="none"
      className="w-7 h-7 flex-shrink-0"
    >
      <rect width="40" height="40" rx="9" fill="url(#footer-grad)" />
      <defs>
        <linearGradient
          id="footer-grad"
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
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

const linkCls =
  'flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors';

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] bg-[#05050a]">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#4f7eff]/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <LogoIcon />
              <div>
                <div className="font-semibold text-white text-sm">BackendKit Labs</div>
                <div className="text-xs text-[#94a3b8]">Enterprise-grade Node.js libraries</div>
              </div>
            </div>
            <p className="text-xs text-[#64748b] max-w-xs leading-relaxed">
              Battle-tested, composable building blocks for Node.js backends.
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            <Link href="/docs/" className={linkCls}>
              Docs
            </Link>
            <a href="#packages" className={linkCls}>
              Packages
            </a>
            <a
              href="https://github.com/BackendKit-labs/backendkit-monorepo"
              target="_blank"
              rel="noopener noreferrer"
              className={linkCls}
            >
              <GitHubIcon />
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/search?q=%40backendkit-labs"
              target="_blank"
              rel="noopener noreferrer"
              className={linkCls}
            >
              npm
            </a>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-[#475569]">
            Released under the{' '}
            <a
              href="https://github.com/BackendKit-labs/backendkit-monorepo/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#64748b] hover:text-[#94a3b8] underline underline-offset-2 transition-colors"
            >
              Apache-2.0 License
            </a>
            .
          </p>
          <p className="text-xs text-[#475569]">
            Copyright &copy; 2024&ndash;2026{' '}
            <span className="text-[#64748b]">Mairon José Cuello Martínez</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
