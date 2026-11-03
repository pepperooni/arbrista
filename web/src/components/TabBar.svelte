<script lang="ts">
  import Icon from './Icon.svelte'
  import type { IconName } from './Icon.svelte'
  import { link, router } from '../lib/router.svelte.ts'

  const tabs: { href: string; label: string; icon: IconName }[] = [
    { href: '/', label: 'À arroser', icon: 'droplet' },
    { href: '/plants', label: 'Plantes', icon: 'sprout' },
    { href: '/household', label: 'Logement', icon: 'house' },
  ]

  const isActive = (href: string) => (href === '/' ? router.path === '/' : router.path.startsWith(href))
</script>

<nav aria-label="Navigation principale">
  {#each tabs as tab (tab.href)}
    <a href={tab.href} use:link aria-current={isActive(tab.href) ? 'page' : undefined}>
      <Icon name={tab.icon} size={24} />
      <span>{tab.label}</span>
    </a>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 20;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(12px);
    border-top: 1px solid var(--border);
  }

  a {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  a[aria-current='page'] {
    color: var(--accent);
  }
</style>
