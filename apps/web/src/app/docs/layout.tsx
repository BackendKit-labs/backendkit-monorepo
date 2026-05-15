import type { Metadata } from 'next';
import DocsSidebar from '@/components/docs/sidebar';

export const metadata: Metadata = {
  title: 'Docs — BackendKit Labs',
  description: 'Documentation for BackendKit Labs packages',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-10 lg:gap-14">
          {/* Sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0 py-10 sticky top-16 self-start max-h-[calc(100vh-4rem)] overflow-y-auto">
            <DocsSidebar />
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 py-10 max-w-3xl">{children}</main>
        </div>
      </div>
    </div>
  );
}
