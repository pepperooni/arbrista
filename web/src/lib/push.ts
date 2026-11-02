import { api } from './api.ts'

export type PushSupport = 'supported' | 'needs-install' | 'unsupported'

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export function pushSupport(): PushSupport {
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (isIos() && !isStandalone()) return 'needs-install' // iOS only allows push for apps added to the home screen
  return capable ? 'supported' : 'unsupported'
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function isSubscribed(): Promise<boolean> {
  return (await currentSubscription()) !== null
}

function base64UrlToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Les notifications sont bloquées pour ce site dans les réglages du téléphone')
  const { publicKey } = await api.get<{ publicKey: string }>('/push/public-key')
  const registration = await navigator.serviceWorker.ready
  let subscription: PushSubscription
  try {
    subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }))
  } catch {
    throw new Error("Impossible d'activer les notifications sur ce navigateur")
  }
  const { endpoint, keys } = subscription.toJSON()
  await api.post('/push/subscriptions', { endpoint, keys })
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  await api.del('/push/subscriptions', { endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}
