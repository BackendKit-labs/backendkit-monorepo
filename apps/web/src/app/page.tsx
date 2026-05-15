import Hero from '@/components/landing/hero';
import Features from '@/components/landing/features';
import LibraryShowcase from '@/components/landing/library-showcase';
import InstallSection from '@/components/landing/install-section';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <LibraryShowcase />
      <InstallSection />
    </>
  );
}
