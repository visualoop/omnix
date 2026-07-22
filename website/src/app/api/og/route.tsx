import { ImageResponse } from 'next/og'

export const runtime = 'edge'

/**
 * Dynamic Open Graph image generator.
 *   GET /api/og?title=Some%20Page%20Title
 * Returns a 1200×630 PNG rendered entirely on the server — no remote fetch.
 * Flat, light-first "Working Counter" card: receipt-white surface, ledger-black
 * ink, one signal-copper accent, and a restrained (≤8px) radius on the mark
 * tile. No gradient, no drop shadow, no unsupported claims.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const title = (searchParams.get('title') || 'Omnix — POS + business software for Kenyan SMEs').slice(0, 120)

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: '#FAFAF7',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Signal-copper rule — the one brand accent, flat and full-bleed */}
        <div style={{ width: '100%', height: '10px', background: '#B94D1C', display: 'flex' }} />

        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '72px',
          }}
        >
          {/* Top row: mark tile + wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '8px',
                background: '#F2F1EB',
                border: '1px solid #D8D5CA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Simplified ring mark in signal copper on the counter-stone tile */}
              <svg width="44" height="44" viewBox="0 0 512 512">
                <circle cx="256" cy="256" r="165" fill="none" stroke="#B94D1C" strokeWidth="64" strokeDasharray="150 60" />
                <circle cx="256" cy="256" r="42" fill="#171713" />
              </svg>
            </div>
            <span style={{ color: '#171713', fontSize: '40px', fontWeight: 700, letterSpacing: '-1px' }}>
              Omnix
            </span>
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              color: '#171713',
              fontSize: '62px',
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: '-1.5px',
              maxWidth: '980px',
            }}
          >
            {title}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#57564F', fontSize: '24px' }}>omnix.co.ke</span>
            <span style={{ color: '#B94D1C', fontSize: '22px', fontWeight: 600 }}>
              Offline-first business software
            </span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
