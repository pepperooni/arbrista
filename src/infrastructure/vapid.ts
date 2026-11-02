/** VAPID keys identify this server to push services (base64url: raw P-256 public point, private scalar `d`). */
export type VapidKeys = { publicKey: string; privateKey: string }

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/** Web Crypto only, so it runs on Node and on Cloudflare Workers alike. */
export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { publicKey: toBase64Url(publicKey), privateKey: d! }
}
