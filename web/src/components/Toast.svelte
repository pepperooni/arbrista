<script lang="ts">
  import { dismissToast, toast } from '../lib/toast.svelte.ts'
</script>

{#if toast.current}
  {@const t = toast.current}
  <div class="toast" role="status" aria-live="polite">
    <span>{t.message}</span>
    {#if t.action}
      <button
        class="action"
        onclick={() => {
          t.action?.run()
          dismissToast()
        }}>{t.action.label}</button
      >
    {/if}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    z-index: 30;
    left: 50%;
    bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom) + var(--space-3));
    transform: translateX(-50%);
    width: min(calc(100% - 2 * var(--space-4)), 480px);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 48px;
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: #1f2a22;
    color: #f2f6f3;
    box-shadow: 0 8px 24px rgb(0 0 0 / 25%);
    animation: rise 0.18s ease-out;
  }

  span {
    flex: 1;
  }

  .action {
    min-height: 40px;
    padding: 0 var(--space-3);
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #8fe0ad;
    font-weight: 700;
    cursor: pointer;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
  }
</style>
