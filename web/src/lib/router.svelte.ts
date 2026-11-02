/** Minimal History-API router: a reactive path plus pattern matching. */
export const router = $state({ path: location.pathname })

window.addEventListener('popstate', () => {
  router.path = location.pathname
})

export function navigate(path: string, options: { replace?: boolean } = {}): void {
  if (path === router.path) return
  if (options.replace) history.replaceState(null, '', path)
  else history.pushState(null, '', path)
  router.path = path
  window.scrollTo(0, 0)
}

export function back(fallback: string): void {
  if (history.length > 1) history.back()
  else navigate(fallback, { replace: true })
}

/** `match('/plants/:id', '/plants/42')` → `{ id: '42' }`; null when the path does not match. */
export function match(pattern: string, path = router.path): Record<string, string> | null {
  const p = pattern.split('/')
  const s = path.replace(/\/+$/, '').split('/')
  if (p.length !== s.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i])
    else if (p[i] !== s[i]) return null
  }
  return params
}

/** Svelte action: turns `<a href>` clicks into client-side navigation. */
export function link(node: HTMLAnchorElement) {
  const onClick = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigate(node.getAttribute('href') ?? '/')
  }
  node.addEventListener('click', onClick)
  return { destroy: () => node.removeEventListener('click', onClick) }
}
