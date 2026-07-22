import { setRequestLocale } from 'next-intl/server'
import {
  Homepage,
  type HomepageMedia,
  type HomepageProduct,
  type HomepageVideo,
} from '@/components/landing/homepage'
import { PRODUCT_MEDIA_SLOTS, getSlotImage, getSlotMedia } from '@/lib/media-slots'
import { getSiteSettings } from '@/lib/site-settings'

// No force-dynamic: the homepage has no request-specific input (locale is a
// route param) and its DB-backed public content (site settings + approved
// media) revalidates on the bounded ISR window below, so it can cache.
export const revalidate = 60

type ProductMediaMap = Partial<Record<HomepageProduct['id'], HomepageMedia>>

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const settings = await getSiteSettings()

  // Task 8 is the only public media path. Missing, rejected or incomplete
  // records intentionally remain absent; Homepage renders a useful no-media state.
  let heroMedia: HomepageMedia | null = null
  let heroVideo: HomepageVideo | null = null
  let heroVideoPoster: HomepageMedia | null = null
  let productMedia: ProductMediaMap = {}

  try {
    const [hero, video, poster, products] = await Promise.all([
      getSlotImage('hero.product_shot'),
      getSlotMedia('hero.video'),
      getSlotImage('hero.video-poster'),
      Promise.all(
        PRODUCT_MEDIA_SLOTS.map(async (product) => {
          const image = await getSlotImage(product.rowSlot)
          return [product.product, image] as const
        }),
      ),
    ])

    heroMedia = hero ? { url: hero.url, alt: hero.alt } : null
    heroVideo = video && poster ? { url: video.url, alt: video.alt, mimeType: video.mimeType } : null
    heroVideoPoster = video && poster ? { url: poster.url, alt: poster.alt } : null
    productMedia = products.reduce<ProductMediaMap>((resolved, [product, image]) => {
      if (image) resolved[product] = { url: image.url, alt: image.alt }
      return resolved
    }, {})
  } catch {
    // Licensed media fails closed. The homepage remains complete without it.
  }

  return (
    <Homepage
      locale={locale}
      heroMedia={heroMedia}
      heroVideo={heroVideo}
      heroVideoPoster={heroVideoPoster}
      productMedia={productMedia}
      whatsappUrl={settings.whatsappUrl}
    />
  )
}
