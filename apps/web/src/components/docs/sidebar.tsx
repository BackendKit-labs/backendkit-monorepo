'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { packageDocs } from '@/lib/package-docs';
import PackageIcon from '@/components/package-icon';

// Sub-sections for the examples page
const examplesSections = [
  { label: 'Checkout Pipeline',         href: '#checkout-pipeline' },
  { label: 'Dashboard Aggregator',      href: '#dashboard-aggregator' },
  { label: 'CSV Batch Import',          href: '#batch-import' },
  { label: 'Secure Search',             href: '#secure-search' },
  { label: 'CLI Deployment Tool',       href: '#cli-deploy' },
  { label: 'Webhook Delivery',          href: '#webhook-delivery' },
  { label: 'Batch Enrichment',          href: '#batch-enrichment' },
  { label: 'Multi-provider Failover',   href: '#multi-provider-failover' },
  { label: 'Validation Pipeline',       href: '#validation-pipeline' },
  { label: 'Price Aggregation',         href: '#price-aggregation' },
];

// Sub-sections shown inside the sidebar when that package is active
const packageSections: Record<string, { label: string; href: string }[]> = {
  result: [
    { label: 'Overview',       href: '#overview' },
    { label: 'Quick Start',    href: '#quickstart' },
    { label: 'Core Concepts',  href: '#core' },
    { label: 'API Reference',  href: '#api' },
    { label: 'Examples',       href: '#examples' },
    { label: 'vs. Alternatives', href: '#comparison' },
  ],
  'circuit-breaker': [
    { label: 'Overview',          href: '#overview' },
    { label: 'States & Lifecycle', href: '#states' },
    { label: 'Configuration',     href: '#config' },
    { label: 'NestJS Integration', href: '#nestjs' },
    { label: 'Examples',          href: '#examples' },
    { label: 'vs. Alternatives',  href: '#comparison' },
  ],
  bulkhead: [
    { label: 'Overview',          href: '#overview' },
    { label: 'How It Works',      href: '#how-it-works' },
    { label: 'Configuration',     href: '#config' },
    { label: 'NestJS Integration', href: '#nestjs' },
    { label: 'Examples',          href: '#examples' },
    { label: 'vs. Alternatives',  href: '#comparison' },
  ],
  observability: [
    { label: 'Overview',        href: '#overview' },
    { label: 'Module Setup',    href: '#setup' },
    { label: 'LoggerService',   href: '#logger' },
    { label: 'MetricsService',  href: '#metrics' },
    { label: 'OpenTelemetry',   href: '#otel' },
    { label: 'Examples',        href: '#examples' },
    { label: 'vs. Alternatives', href: '#comparison' },
  ],
  pipeline: [
    { label: 'Overview',         href: '#overview' },
    { label: 'Building a Pipeline', href: '#building' },
    { label: 'Writing Handlers', href: '#handlers' },
    { label: 'Execution Modes',  href: '#modes' },
    { label: 'Examples',         href: '#examples' },
    { label: 'vs. Alternatives', href: '#comparison' },
  ],
  'http-client': [
    { label: 'Overview',            href: '#overview' },
    { label: 'Configuration',       href: '#config' },
    { label: 'Making Requests',     href: '#requests' },
    { label: 'Error Types',         href: '#errors' },
    { label: 'Retry & Circuit Breaker', href: '#resilience' },
    { label: 'Examples',            href: '#examples' },
    { label: 'vs. Alternatives',    href: '#comparison' },
  ],
  'request-scanner': [
    { label: 'Overview',          href: '#overview' },
    { label: 'Detection Rules',   href: '#rules' },
    { label: 'Configuration',     href: '#config' },
    { label: 'Express Middleware', href: '#middleware' },
    { label: 'NestJS Guard',      href: '#nestjs' },
    { label: 'Examples',          href: '#examples' },
    { label: 'vs. Alternatives',  href: '#comparison' },
  ],
  'console-animations': [
    { label: 'Overview',          href: '#overview' },
    { label: 'Animation Types',   href: '#types' },
    { label: 'Manager API',       href: '#manager' },
    { label: 'Builder API',       href: '#builder' },
    { label: 'Examples',          href: '#examples' },
  ],
};

const gettingStartedLinks = [
  { label: 'Introduction', href: '/docs/' },
  { label: 'Installation',  href: '/docs/#installation' },
  { label: 'Quick start',   href: '/docs/#quickstart' },
  { label: 'Examples',      href: '/docs/examples/' },
];

const resourceLinks = [
  { label: 'GitHub',     href: 'https://github.com/BackendKit-labs/backendkit-monorepo', external: true },
  { label: 'npm',        href: 'https://www.npmjs.com/search?q=%40backendkit-labs',     external: true },
  { label: 'Changelog',  href: 'https://github.com/BackendKit-labs/backendkit-monorepo/blob/main/CHANGELOG.md', external: true },
];

export default function DocsSidebar() {
  const pathname = usePathname();

  // Detect current package from the URL, e.g. /docs/circuit-breaker/
  const currentSlug = packageDocs.find((p) => pathname === `/docs/${p.slug}/`)?.slug ?? null;
  const isExamples = pathname === '/docs/examples/' || pathname === '/docs/examples';

  const linkCls = (active: boolean) =>
    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-[14px] transition-all duration-150 ${
      active
        ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-white/[0.07] font-medium'
        : 'text-slate-500 dark:text-[#64748b] hover:text-slate-700 dark:hover:text-[#94a3b8] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
    }`;

  const subLinkCls = (href: string) => {
    const active = typeof window !== 'undefined' && window.location.hash === href;
    return `flex items-center gap-2 pl-7 pr-3 py-1 rounded-lg text-[13.5px] transition-all duration-150 ${
      active ? 'text-gray-900 dark:text-white' : 'text-slate-400 dark:text-[#475569] hover:text-slate-600 dark:hover:text-[#94a3b8] hover:bg-gray-50 dark:hover:bg-white/[0.03]'
    }`;
  };

  return (
    <nav className="space-y-7">
      {/* Getting Started */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-[#475569] mb-2 px-3">
          Getting Started
        </div>
        <ul className="space-y-0.5">
          {gettingStartedLinks.map((link) => {
            const isExamplesLink = link.href === '/docs/examples/';
            const active = isExamplesLink
              ? isExamples
              : pathname === link.href.split('#')[0] && !currentSlug && !isExamples;
            return (
              <li key={link.label}>
                <Link href={link.href} className={linkCls(active)}>
                  {link.label}
                </Link>
                {/* Sub-sections for the examples page */}
                {isExamplesLink && isExamples && (
                  <ul className="mt-0.5 space-y-0.5 mb-1">
                    {examplesSections.map((s) => (
                      <li key={s.href}>
                        <a href={s.href} className={subLinkCls(s.href)}>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-[#475569] flex-shrink-0" />
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Packages */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-[#475569] mb-2 px-3">
          Packages
        </div>
        <ul className="space-y-0.5">
          {packageDocs.map((pkg) => {
            const isActive = currentSlug === pkg.slug;
            const sections = packageSections[pkg.slug] ?? [];

            return (
              <li key={pkg.slug}>
                <Link
                  href={`/docs/${pkg.slug}/`}
                  className={`${linkCls(isActive)} relative`}
                  style={isActive ? { color: pkg.color } : undefined}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r"
                      style={{ background: pkg.color }}
                    />
                  )}
                  <PackageIcon abbr={pkg.icon} color={pkg.color} size={22} />
                  <span>{pkg.name}</span>
                  <span className="ml-auto text-[10px] font-mono text-slate-400 dark:text-[#475569]">v{pkg.version}</span>
                </Link>

                {/* Sub-sections — only when this package is active */}
                {isActive && sections.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5 mb-1">
                    {sections.map((s) => (
                      <li key={s.href}>
                        <a href={s.href} className={subLinkCls(s.href)}>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-[#475569] flex-shrink-0" />
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Resources */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-[#475569] mb-2 px-3">
          Resources
        </div>
        <ul className="space-y-0.5">
          {resourceLinks.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={linkCls(false)}
              >
                {link.label}
                <svg className="w-3 h-3 ml-auto opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
