const { mkdirSync } = require('node:fs')
const { resolve } = require('node:path')
const { chromium } = require('playwright')

const executablePath = '/home/ubuntu/.cache/ms-playwright/chromium-1223/chrome-linux/chrome'
const baseURL = process.env.SHOWCASE_BASE_URL ?? 'http://127.0.0.1:4177'
const outputDirectory = resolve(process.env.SHOWCASE_OUTPUT_DIR ?? '.showcase-validation')
const measurementWidths = [390, 768, 1024, 1440]
const screenshotWidths = new Set([390, 768, 1440])
const overflowWidths = [320, 390]

let approvedAssets = null

async function getPublicApprovedAssets(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await page.goto('https://omnix.co.ke/ke', { waitUntil: 'domcontentloaded' })
    await page.locator('main img').first().waitFor()
    const assets = await page.locator('main img').evaluateAll((images) =>
      images.slice(0, 6).map((image) => ({
        src: image.currentSrc || image.src,
        alt: image.alt,
        width: Number(image.getAttribute('width')) || image.naturalWidth,
        height: Number(image.getAttribute('height')) || image.naturalHeight,
      })),
    )
    if (assets.length !== 6)
      throw new Error(`Expected 6 approved public images, found ${assets.length}`)
    return assets
  } finally {
    await page.close()
  }
}

async function applyApprovedAssets(page, assets) {
  await page.locator('[data-showcase-frame]').evaluateAll((frames, fixtureAssets) => {
    frames.forEach((frame, index) => {
      const asset = fixtureAssets[index]
      if (!asset || frame.querySelector('img')) return
      const moduleClass = [...frame.classList].find(
        (name) => name.endsWith('__heroMedia') || name.endsWith('__productMedia'),
      )
      if (!moduleClass)
        throw new Error(`Unable to identify CSS module class for media frame ${index + 1}`)
      const prefix = moduleClass.replace(/(?:heroMedia|productMedia)$/, '')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `${prefix}mediaTrigger`
      button.setAttribute('aria-label', `Open full-size view: ${asset.alt}`)
      const image = document.createElement('img')
      image.className = `${prefix}showcaseImage`
      image.src = asset.src
      image.alt = asset.alt
      image.width = asset.width || (index === 0 ? 960 : 800)
      image.height = asset.height || (index === 0 ? 720 : 500)
      const label = document.createElement('span')
      label.className = `${prefix}inspectLabel`
      label.setAttribute('aria-hidden', 'true')
      label.textContent = 'View full size'
      button.append(image, label)
      frame.replaceChildren(button)
      frame.setAttribute('data-media-state', 'approved')
    })
  }, assets)
}

async function loadHomepage(page, width, browser) {
  await page.setViewportSize({ width, height: 1000 })
  await page.goto(`${baseURL}/ke`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-homepage-acquisition]').waitFor()
  if (
    (await page.locator('[data-showcase-frame][data-media-state="approved"] img').count()) === 0
  ) {
    approvedAssets ??= await getPublicApprovedAssets(browser)
    await applyApprovedAssets(page, approvedAssets)
  }
  await page
    .locator('[data-showcase-frame][data-media-state="approved"] img')
    .evaluateAll(async (images) => {
      await Promise.all(images.map((image) => image.decode()))
    })
}

async function main() {
  mkdirSync(outputDirectory, { recursive: true })
  const browser = await chromium.launch({ executablePath })
  const page = await browser.newPage()
  const measurements = []

  try {
    for (const width of measurementWidths) {
      await loadHomepage(page, width, browser)
      const media = await page
        .locator('[data-showcase-frame][data-media-state="approved"]')
        .evaluateAll((frames) =>
          frames.map((frame, index) => {
            const image = frame.querySelector('img')
            if (!(image instanceof HTMLImageElement)) {
              throw new Error(`Approved media frame ${index + 1} has no image`)
            }
            const boxHeight = frame.getBoundingClientRect().height
            const imageHeight = image.getBoundingClientRect().height
            return {
              index: index + 1,
              alt: image.alt,
              boxHeight: Number(boxHeight.toFixed(3)),
              imageHeight: Number(imageHeight.toFixed(3)),
              difference: Number((boxHeight - imageHeight).toFixed(3)),
            }
          }),
        )

      if (media.length === 0) throw new Error(`No approved showcase images rendered at ${width}px`)
      const gaps = media.filter(({ difference }) => Math.abs(difference) > 0.5)
      if (gaps.length > 0) throw new Error(`Media gaps at ${width}px: ${JSON.stringify(gaps)}`)
      measurements.push({ width, media })

      if (screenshotWidths.has(width)) {
        await page.screenshot({
          path: resolve(outputDirectory, `homepage-${width}.png`),
          fullPage: true,
        })
      }
    }

    const overflow = []
    for (const width of overflowWidths) {
      await loadHomepage(page, width, browser)
      const result = await page.evaluate(() => {
        const documentWidth = Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        )
        const viewportWidth = window.innerWidth
        return {
          documentWidth,
          viewportWidth,
          horizontalOverflow: Math.max(0, documentWidth - viewportWidth),
        }
      })
      if (result.horizontalOverflow !== 0) {
        throw new Error(`Horizontal overflow at ${width}px: ${JSON.stringify(result)}`)
      }
      overflow.push({ width, ...result })
    }

    console.log(JSON.stringify({ baseURL, measurements, overflow }, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
