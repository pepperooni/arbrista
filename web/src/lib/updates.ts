import { registerSW } from 'virtual:pwa-register'
import { router } from './router.svelte.ts'
import { showToast } from './toast.svelte.ts'

const CHECK_EVERY_MS = 60 * 60 * 1000

/** Pages where an automatic reload would lose what the user is typing. */
const isEditing = () => /^\/plants\/(new|[^/]+\/edit)$/.test(router.path)

/**
 * Keeps the installed app up to date: looks for a new version when the app comes back to the
 * foreground (and hourly), and switches to it as soon as it is ready — at once, or after a tap
 * when a form is open.
 */
export function keepAppUpToDate(): void {
  if (!('serviceWorker' in navigator)) return
  // The very first install also changes the controller: that one must not reload the page.
  const hadController = navigator.serviceWorker.controller !== null
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    const reload = () => {
      reloading = true
      location.reload()
    }
    if (isEditing()) showToast('Nouvelle version disponible', { label: 'Mettre à jour', run: reload }, 15_000)
    else reload()
  })

  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => registration.update().catch(() => {})
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      setInterval(check, CHECK_EVERY_MS)
    },
  })
}
