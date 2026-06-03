import Image from 'next/image'
import { BrowserFrame } from './browser-frame'

export interface PayloadMedia {
  url?: string | null
  width?: number | null
  height?: number | null
  alt?: string | null
}

type FrameProps = Omit<Parameters<typeof BrowserFrame>[0], 'children'>

/**
 * Renders a Payload-uploaded image inside the Windows Chrome BrowserFrame.
 * Returns null when no media — callers can fall back to a static preview.
 */
export function PayloadImage({
  media,
  sizes = '(max-width: 768px) 100vw, 1080px',
  ...frameProps
}: { media: PayloadMedia | null | undefined; sizes?: string } & FrameProps) {
  if (!media?.url) return null
  return (
    <BrowserFrame {...frameProps}>
      <Image
        src={media.url}
        alt={media.alt ?? ''}
        width={media.width ?? 1200}
        height={media.height ?? 800}
        className="h-auto w-full"
        sizes={sizes}
      />
    </BrowserFrame>
  )
}
