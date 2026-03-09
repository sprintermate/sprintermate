import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Sprintermate AI — AI-Powered Agile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid overlay — satori requires display:flex on every element */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.08) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            display: 'flex',
          }}
        />
        {/* Top-right glow orb */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-120px',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        {/* Bottom-left glow orb */}
        <div
          style={{
            position: 'absolute',
            bottom: '-120px',
            left: '-120px',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            zIndex: 10,
            padding: '0 80px',
            textAlign: 'center',
          }}
        >
          {/* Logo row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 40px rgba(99,102,241,0.5)',
              }}
            >
              <span style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800 }}>SA</span>
            </div>
            <span style={{ color: '#ffffff', fontSize: '32px', fontWeight: 700 }}>
              Sprintermate AI
            </span>
          </div>

          {/* Headline */}
          <div
            style={{
              color: '#ffffff',
              fontSize: '72px',
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-2px',
            }}
          >
            AI-Powered Agile
          </div>

          {/* Subheadline */}
          <div
            style={{
              color: '#94a3b8',
              fontSize: '28px',
              fontWeight: 400,
              lineHeight: 1.4,
              maxWidth: '800px',
            }}
          >
            Planning poker · AI estimation · Azure DevOps · Retrospectives
          </div>

          {/* Fibonacci cards row */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            {[1, 2, 3, 5, 8, 13, 21].map((n) => (
              <div
                key={n}
                style={{
                  width: '56px',
                  height: '72px',
                  borderRadius: '10px',
                  border: '1px solid rgba(99,102,241,0.4)',
                  background: 'rgba(99,102,241,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#a5b4fc',
                  fontSize: '22px',
                  fontWeight: 700,
                }}
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
