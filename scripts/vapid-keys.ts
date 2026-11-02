// Prints a fresh VAPID key pair, to store as Cloudflare secrets:
//   npx wrangler secret put VAPID_PUBLIC_KEY   (then paste the public key)
//   npx wrangler secret put VAPID_PRIVATE_KEY  (then paste the private key)
import { generateVapidKeys } from '../src/infrastructure/vapid.ts'

const keys = await generateVapidKeys()
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
