<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    open = $bindable(false),
    title,
    onclose,
    children,
  }: { open?: boolean; title: string; onclose?: () => void; children: Snippet } = $props()

  let dialog: HTMLDialogElement

  $effect(() => {
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  })
</script>

<dialog
  bind:this={dialog}
  onclose={() => {
    open = false
    onclose?.()
  }}
  onclick={(e) => e.target === dialog && (open = false)}
  aria-label={title}
>
  <div class="sheet">
    <div class="grip" aria-hidden="true"></div>
    <h2>{title}</h2>
    {@render children()}
  </div>
</dialog>

<style>
  dialog {
    margin: auto auto 0;
    width: 100%;
    max-width: var(--content-max);
    max-height: 90dvh;
    padding: 0;
    border: 0;
    border-radius: 20px 20px 0 0;
    background: var(--surface);
    color: var(--text);
  }

  dialog[open] {
    animation: up 0.2s ease-out;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 40%);
  }

  .sheet {
    padding: var(--space-2) var(--space-4) calc(var(--space-5) + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .grip {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    margin: 0 auto var(--space-2);
  }

  h2 {
    font-size: 1.15rem;
  }

  @keyframes up {
    from {
      transform: translateY(40px);
      opacity: 0;
    }
  }
</style>
