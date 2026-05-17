import { defineConfig } from 'vitepress'

export default defineConfig({
  title:       'BackendKit Labs',
  description: 'Composable building blocks for resilient Node.js backends.',
  lang:        'en-US',
  base:        '/backendkit-monorepo/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide',    link: '/guide/getting-started', activeMatch: '/guide/' },
      {
        text:        'Packages',
        activeMatch: '/packages/',
        items: [
          { text: 'Result',             link: '/packages/result' },
          { text: 'Circuit Breaker',    link: '/packages/circuit-breaker' },
          { text: 'Bulkhead',           link: '/packages/bulkhead' },
          { text: 'Observability',      link: '/packages/observability' },
          { text: 'Pipeline',           link: '/packages/pipeline' },
          { text: 'HTTP Client',        link: '/packages/http-client' },
          { text: 'Request Scanner',    link: '/packages/request-scanner' },
          { text: 'Auto-Learning',      link: '/packages/auto-learning' },
          { text: 'Console Animations', link: '/packages/console-animations' },
        ],
      },
      { text: 'Blog', link: '/blog/', activeMatch: '/blog/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text:  'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
          ],
        },
      ],
      '/packages/': [
        {
          text:  'Packages',
          items: [
            { text: 'Result',             link: '/packages/result' },
            { text: 'Circuit Breaker',    link: '/packages/circuit-breaker' },
            { text: 'Bulkhead',           link: '/packages/bulkhead' },
            { text: 'Observability',      link: '/packages/observability' },
            { text: 'Pipeline',           link: '/packages/pipeline' },
            { text: 'HTTP Client',        link: '/packages/http-client' },
            { text: 'Request Scanner',    link: '/packages/request-scanner' },
            { text: 'Auto-Learning',      link: '/packages/auto-learning' },
            { text: 'Console Animations', link: '/packages/console-animations' },
          ],
        },
      ],
      '/blog/': [
        {
          text:  'Blog',
          items: [
            { text: 'All posts',                              link: '/blog/' },
            { text: 'From try/catch to explicit errors',      link: '/blog/try-catch-to-result' },
            { text: 'Circuit breaker & business errors',      link: '/blog/circuit-breaker-business-errors' },
            { text: 'Why we built our own Result type',       link: '/blog/why-result' },
          ],
        },
      ],
    },

    editLink: {
      pattern: 'https://github.com/BackendKit-labs/backendkit-monorepo/edit/master/apps/docs/:path',
      text:    'Edit this page on GitHub',
    },

    lastUpdated: { text: 'Last updated' },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/BackendKit-labs/backendkit-monorepo' },
      { icon: 'npm',    link: 'https://www.npmjs.com/org/backendkit-labs' },
    ],

    footer: {
      message:   'Released under the Apache 2.0 License.',
      copyright: 'Copyright © 2024–2026 Mairon José Cuello Martínez',
    },

    search: { provider: 'local' },
  },
})
