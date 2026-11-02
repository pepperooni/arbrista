<script lang="ts">
  import type { Care } from '../../../src/shared/api-types.ts'
  import { EXPOSURE_LABELS, HUMIDITY_LABELS } from '../lib/format.ts'
  import Icon from './Icon.svelte'

  let { care }: { care: Care } = $props()
</script>

{#if care.exposure || care.humidity || care.temperature}
  <ul class="care">
    {#if care.exposure}
      <li><Icon name="sun" size={18} /><span>{EXPOSURE_LABELS[care.exposure]}</span></li>
    {/if}
    {#if care.humidity}
      <li><Icon name="droplet" size={18} /><span>Humidité {HUMIDITY_LABELS[care.humidity].toLowerCase()}</span></li>
    {/if}
    {#if care.temperature}
      <li><Icon name="thermometer" size={18} /><span>{care.temperature}</span></li>
    {/if}
  </ul>
{/if}

<style>
  .care {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: 0;
    margin: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-size: 0.88rem;
    font-weight: 600;
  }
</style>
