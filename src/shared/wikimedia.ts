/**
 * Wikimedia thumbnails are named `…/thumb/<path>/<width>px-<file>`: changing the width asks the
 * image servers for another rendition. Originals and already larger thumbnails are left as is.
 */
export function largerThumbnail(src: string, width: number): string {
  const match = /\/thumb\/.+\/(\d+)px-[^/]+$/.exec(src)
  if (!match || Number(match[1]) >= width) return src
  return src.replace(/\/(\d+)px-([^/]+)$/, `/${width}px-$2`)
}
