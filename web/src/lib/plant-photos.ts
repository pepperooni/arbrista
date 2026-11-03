import type { CatalogPlant } from '../../../src/shared/plant-catalog.ts'
import { largerThumbnail } from '../../../src/shared/wikimedia.ts'
import { resizeImage } from './image.ts'

export type PlantPhotos = { images: string[]; pageUrl: string }

const WIKI = 'https://en.wikipedia.org/api/rest_v1/page'
const MAX_IMAGES = 4
const cache = new Map<string, Promise<PlantPhotos | null>>()

type Summary = {
  type: string
  titles: { canonical: string }
  thumbnail?: { source: string }
  content_urls: { mobile: { page: string } }
}
type MediaList = { items: { type: string; showInGallery?: boolean; srcset?: { src: string }[] }[] }

const absolute = (src: string) => (src.startsWith('//') ? `https:${src}` : src)

async function fromPage(title: string): Promise<PlantPhotos | null> {
  const res = await fetch(`${WIKI}/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)
  if (!res.ok) return null
  const summary = (await res.json()) as Summary
  if (summary.type === 'disambiguation' || !summary.thumbnail) return null
  const images = [summary.thumbnail.source]
  try {
    const media = (await (await fetch(`${WIKI}/media-list/${encodeURIComponent(summary.titles.canonical)}`)).json()) as MediaList
    for (const item of media.items) {
      const src = item.type === 'image' && item.showInGallery ? item.srcset?.[0]?.src : undefined
      if (src) images.push(absolute(src))
    }
  } catch {
    /* the summary picture is enough */
  }
  const unique = [...new Set(images)].filter((src) => !/\.svg/i.test(src))
  return { images: unique.slice(0, MAX_IMAGES), pageUrl: summary.content_urls.mobile.page }
}

/** Photos from Wikipedia / Wikimedia Commons, trying the species, then broader names. */
export function fetchPlantPhotos(p: CatalogPlant): Promise<PlantPhotos | null> {
  let pending = cache.get(p.id)
  if (!pending) {
    pending = (async () => {
      const { wikiTitles } = await import('../../../src/shared/catalog.ts')
      for (const title of wikiTitles(p)) {
        const found = await fromPage(title).catch(() => null)
        if (found) return found
      }
      return null
    })()
    cache.set(p.id, pending)
  }
  return pending
}

async function fetchImage(src: string): Promise<Blob> {
  const res = await fetch(src, { mode: 'cors', referrerPolicy: 'no-referrer' })
  const blob = await res.blob()
  if (!res.ok || !blob.type.startsWith('image/')) throw new Error(`Image indisponible (${res.status})`)
  return blob
}

/** A library picture, downloaded in good resolution and resized like a photo taken with the phone. */
export async function downloadLibraryPhoto(src: string): Promise<Blob> {
  let blob: Blob
  try {
    blob = await fetchImage(largerThumbnail(src, 1600))
  } catch {
    blob = await fetchImage(src) // the original may be smaller than the requested rendition
  }
  return resizeImage(blob)
}
