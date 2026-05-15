import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import Nav from '@/components/nav';
import Footer from '@/components/footer';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BackendKit Labs — Enterprise-grade Node.js libraries',
  description:
    'Battle-tested, composable building blocks for Node.js. Framework-agnostic cores with optional NestJS integration.',
  keywords: [
    'nodejs',
    'typescript',
    'nestjs',
    'result monad',
    'circuit breaker',
    'bulkhead',
    'observability',
    'backend',
    'libraries',
  ],
  authors: [{ name: 'Mairon José Cuello Martínez' }],
  openGraph: {
    title: 'BackendKit Labs',
    description: 'Enterprise-grade Node.js libraries',
    url: 'https://backendkitlabs.dev',
    siteName: 'BackendKit Labs',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BackendKit Labs',
    description: 'Enterprise-grade Node.js libraries',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="bg-white dark:bg-[#05050a] text-gray-900 dark:text-white antialiased" suppressHydrationWarning>
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('theme');if(s==='light'){document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}})();`,
          }}
        />
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
