'use client';

import Link from 'next/link';
import { ThemeToggleButton } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';

export function MarketingLandingPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }} data-lk-theme="default">
      {/* Header */}
      <header style={{
        height: '64px',
        background: 'var(--lk-bg, #000000)',
        borderBottom: '1px solid rgba(128, 128, 128, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0
      }}>
        <span style={{
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--foreground)',
          letterSpacing: '-0.03rem'
        }}>
          bayaan.ai
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/signup">
            <Button>Get Started</Button>
          </Link>
          <ThemeToggleButton start="top-right" />
        </div>
      </header>

      {/* Hero Section */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px' }}>
          <h1 style={{
            fontSize: '56px',
            fontWeight: 800,
            marginBottom: '24px',
            color: 'var(--foreground)',
            lineHeight: 1.2
          }}>
            Real-Time Translation
            <br />
            for Modern Classrooms
          </h1>
          <p style={{
            fontSize: '20px',
            marginBottom: '40px',
            color: 'var(--lk-fg2)',
            lineHeight: 1.6
          }}>
            Connect teachers and students across language barriers with live video conferencing
            and real-time translation. Perfect for multilingual education.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/signup">
              <Button size="lg" style={{ fontSize: '18px', padding: '24px 32px' }}>
                Start Free Trial
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" style={{ fontSize: '18px', padding: '24px 32px' }}>
                Sign In to Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div style={{
          marginTop: '80px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '32px',
          maxWidth: '1200px',
          width: '100%'
        }}>
          {[
            {
              title: 'Live Video Conferencing',
              description: 'High-quality video and audio powered by LiveKit'
            },
            {
              title: 'Real-Time Translation',
              description: 'Break language barriers with instant translation'
            },
            {
              title: 'Classroom Management',
              description: 'Teacher controls, student permissions, and more'
            },
            {
              title: 'Persistent Rooms',
              description: 'Create reusable room codes for recurring classes'
            }
          ].map((feature) => (
            <div
              key={feature.title}
              style={{
                padding: '24px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(128, 128, 128, 0.2)'
              }}
            >
              <h3 style={{
                fontSize: '20px',
                fontWeight: 600,
                marginBottom: '8px',
                color: 'var(--foreground)'
              }}>
                {feature.title}
              </h3>
              <p style={{
                fontSize: '14px',
                color: 'var(--lk-fg2)',
                lineHeight: 1.5
              }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '24px',
        borderTop: '1px solid rgba(128, 128, 128, 0.2)',
        textAlign: 'center',
        color: 'var(--lk-fg2)',
        fontSize: '14px'
      }}>
        <p>&copy; 2025 Bayaan Classroom. All rights reserved.</p>
      </footer>
    </div>
  );
}