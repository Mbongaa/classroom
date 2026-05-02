import { ImageResponse } from 'next/og';

export const alt =
  'Bayaan.ai — Real-time speech translation for classrooms, sermons & conferences';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#fdfbf7',
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,77,77,0.08) 0%, transparent 50%), radial-gradient(circle at 85% 80%, rgba(45,93,161,0.06) 0%, transparent 50%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '72px 96px',
          justifyContent: 'space-between',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top row — wordmark + brand mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              fontSize: 64,
              fontWeight: 800,
              color: '#2d2d2d',
              letterSpacing: -2,
            }}
          >
            <span>bayaan</span>
            <span style={{ color: '#ff4d4d' }}>.ai</span>
          </div>
          <div
            style={{
              width: 96,
              height: 96,
              background: '#ff4d4d',
              borderRadius: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fdfbf7',
              fontSize: 64,
              fontWeight: 800,
              fontFamily: 'serif',
              letterSpacing: -2,
            }}
          >
            B
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              color: '#2d2d2d',
              letterSpacing: -3,
              lineHeight: 1.05,
              maxWidth: 980,
              display: 'flex',
            }}
          >
            Real-time speech translation
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 500,
              color: '#5a5a5a',
              lineHeight: 1.3,
              maxWidth: 980,
              display: 'flex',
            }}
          >
            for classrooms, sermons & conferences — break language barriers in
            every room.
          </div>
        </div>

        {/* Bottom row — feature pills */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
          }}
        >
          {['50+ languages', '~2.5s latency', 'live captions'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '14px 26px',
                background: '#ffffff',
                border: '2px solid #2d2d2d',
                borderRadius: 999,
                fontSize: 24,
                fontWeight: 600,
                color: '#2d2d2d',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
