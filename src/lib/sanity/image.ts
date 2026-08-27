import imageUrlBuilder from '@sanity/image-url'
import {dataset, projectId} from './client'

const builder = imageUrlBuilder({projectId, dataset})

export type Photo = {
  asset?: {_ref?: string; url?: string; metadata?: any}
  alt?: string
  caption?: string
  hotspot?: unknown
  crop?: unknown
} | null | undefined

/**
 * Sanity serves WebP/AVIF to browsers that accept them, so `auto=format` does
 * the format work and `fit=max` never upscales. Crops follow the hotspot the
 * client set, which is what keeps a photo of any shape usable in a fixed slot.
 */
export function imageUrl(photo: Photo, width: number, height?: number) {
  if (!photo?.asset) return undefined
  let url = builder.image(photo as any).width(width).auto('format').quality(80)
  url = height ? url.height(height).fit('crop') : url.fit('max')
  return url.url()
}

/** 1x and 2x, so the image stays sharp on a retina screen. */
export function imageSrcSet(photo: Photo, width: number, height?: number) {
  if (!photo?.asset) return undefined
  const one = imageUrl(photo, width, height)
  const two = imageUrl(photo, width * 2, height ? height * 2 : undefined)
  return one && two ? `${one} 1x, ${two} 2x` : one
}

/** Full-size variant for the lightbox. */
export const lightboxUrl = (photo: Photo) => imageUrl(photo, 2000)

/**
 * Sanity's low-quality image placeholder — a tiny inline data URI used as the
 * CSS background so the layout does not flash white while the photo loads.
 */
export const lqip = (photo: Photo): string | undefined =>
  photo?.asset?.metadata?.lqip

export const altOf = (photo: Photo) => photo?.alt ?? ''

/** Everything an `<img>` needs, ready to spread. */
export function imgAttrs(photo: Photo, width: number, height?: number) {
  const src = imageUrl(photo, width, height)
  if (!src) return null
  return {
    src,
    srcset: imageSrcSet(photo, width, height),
    alt: altOf(photo),
    width: photo?.asset?.metadata?.dimensions?.width,
    height: photo?.asset?.metadata?.dimensions?.height,
  }
}
