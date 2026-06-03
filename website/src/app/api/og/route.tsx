import { ImageResponse } from 'next/og'

export const runtime = 'edge'

/**
 * Dynamic Open Graph image generator.
 *   GET /api/og?title=Some%20Page%20Title
 * Returns a 1200×630 PNG with the Omnix mark + the title on the brand
 * navy gradient. Used as the default OG image when a page has no custom one.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const title = (searchParams.get('title') || 'Omnix — ERP for Kenyan SMEs').slice(0, 120)

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 55%, #1E40AF 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top row: mark + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Simplified ring mark */}
            <svg width="48" height="48" viewBox="0 0 512 512">
              <circle cx="256" cy="256" r="165" fill="none" stroke="#FFFFFF" strokeWidth="64" strokeDasharray="150 60" />
              <circle cx="256" cy="256" r="42" fill="#FFFFFF" />
            </svg>
          </div>
          <span style={{ color: '#FFFFFF', fontSize: '40px', fontWeight: 700, letterSpacing: '-1px' }}>
            Omnix
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            color: '#FFFFFF',
            fontSize: '64px',
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
            maxWidth: '900px',
          }}
        >
          {title}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94A3B8', fontSize: '24px' }}>omnix.co.ke</span>
          <span style={{ color: '#60A5FA', fontSize: '22px', fontWeight: 600 }}>
            Pay once · Use forever
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
