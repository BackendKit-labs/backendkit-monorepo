import Hero from '@/components/landing/hero';
import Features from '@/components/landing/features';
import LibraryShowcase from '@/components/landing/library-showcase';
import AutoLearningSection from '@/components/landing/auto-learning-section';
import AboutSection from '@/components/landing/about-section';
import InstallSection from '@/components/landing/install-section';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <LibraryShowcase />
      <AutoLearningSection />
      <AboutSection />
      <InstallSection />
    </>
  );
}
