<script lang="ts">
  let { done, total }: { done: number; total: number } = $props()
  const pct = $derived(total === 0 ? 0 : Math.round((done / total) * 100))
</script>

<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={done} aria-label="Progression de la session">
  <div class="fill" style:width="{pct}%"></div>
</div>

<style>
  .bar {
    height: 8px;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--water), var(--accent));
    transition: width 0.3s ease;
  }
</style>
