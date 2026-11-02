<script lang="ts">
  import { api, errorMessage } from '../lib/api.ts'
  import Sheet from './Sheet.svelte'

  let { open = $bindable(false) }: { open?: boolean } = $props()

  let code = $state<string | null>(null)
  let error = $state('')

  async function generate() {
    code = null
    error = ''
    try {
      code = (await api.post<{ code: string; expiresAt: string }>('/devices/code')).code
    } catch (e) {
      error = errorMessage(e)
    }
  }

  // A fresh code each time the sheet opens.
  $effect(() => {
    if (open) generate()
  })

  const formatted = $derived(code ? `${code.slice(0, 4)}-${code.slice(4)}` : '')
</script>

<Sheet bind:open title="Connecter un autre appareil">
  <p class="muted">
    Sur l'autre appareil, ouvrez Arbrista et saisissez ce code dans <strong>Déjà membre du logement ?</strong>. Vous y serez connecté avec
    votre prénom et votre historique.
  </p>
  {#if code}
    <p class="code" aria-label="Code de connexion {code.split('').join(' ')}">{formatted}</p>
    <p class="muted small">Valable 15 minutes, une seule fois.</p>
  {:else if error}
    <p class="error" role="alert">{error}</p>
  {:else}
    <p class="code loading" aria-busy="true">····-····</p>
  {/if}
  <p class="muted small">
    Sur iPhone, l'application ajoutée à l'écran d'accueil ne partage pas la connexion de Safari : utilisez ce code pour vous y connecter.
  </p>
  <button class="btn btn-ghost btn-block" onclick={generate}>Nouveau code</button>
</Sheet>

<style>
  .code {
    margin: var(--space-2) 0 0;
    text-align: center;
    font-size: 2.2rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    font-variant-numeric: tabular-nums;
    user-select: all;
  }

  .loading {
    color: var(--text-muted);
  }

  .small {
    font-size: 0.88rem;
    text-align: center;
  }

  .error {
    color: var(--danger);
  }
</style>
