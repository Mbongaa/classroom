import TestHeroUI from '@/app/components/TestHeroUI';

export default function TestPage() {
  return (
    <div style={{ minHeight: '100vh', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
        HeroUI Test - Exact Example from Docs
      </h1>
      <TestHeroUI />
    </div>
  );
}
