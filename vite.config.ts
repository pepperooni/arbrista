import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  root: 'web',
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: {
    proxy: { '/api': 'http://localhost:3000', '/photos': 'http://localhost:3000' },
  },
  plugins: [
    svelte(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'] },
      manifest: {
        name: 'Arbrista',
        short_name: 'Arbrista',
        description: "Le suivi d'arrosage des plantes de la maison",
        lang: 'fr',
        theme_color: '#2f7d4f',
        background_color: '#f6f8f5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
