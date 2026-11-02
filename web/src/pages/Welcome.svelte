<script lang="ts">
  import type { AuthDto } from '../../../src/shared/api-types.ts'
  import { api, errorMessage } from '../lib/api.ts'
  import { navigate } from '../lib/router.svelte.ts'
  import { signIn } from '../lib/session.svelte.ts'

  let { initialized }: { initialized: boolean } = $props()

  let householdName = $state('')
  let occupantName = $state('')
  let error = $state('')
  let busy = $state(false)

  async function create(e: SubmitEvent) {
    e.preventDefault()
    busy = true
    error = ''
    try {
      const auth = await api.post<AuthDto>('/setup', { householdName, occupantName })
      signIn(auth.token, auth.occupant)
      navigate('/', { replace: true })
    } catch (err) {
      error = errorMessage(err)
    } finally {
      busy = false
    }
  }
</script>

<main class="welcome">
  <div class="logo" aria-hidden="true"><img src="/icon.svg" alt="" width="88" height="88" /></div>
  <h1>Arbrista</h1>
  <p class="muted tagline">Les plantes de la maison, arrosées au bon moment, sans y penser.</p>

  {#if initialized}
    <div class="card info">
      <h2>Rejoindre le logement</h2>
      <p class="muted">Demandez à un occupant de vous envoyer le lien d'invitation depuis l'onglet <strong>Logement</strong>, puis ouvrez-le sur ce téléphone.</p>
    </div>
  {:else}
    <form class="card stack form" onsubmit={create}>
      <h2>Créer votre logement</h2>
      <label class="field">
        <span>Nom du logement</span>
        <input class="input" bind:value={householdName} placeholder="La maison" required maxlength="60" autocomplete="off" />
      </label>
      <label class="field">
        <span>Votre prénom</span>
        <input class="input" bind:value={occupantName} placeholder="Léa" required maxlength="60" autocomplete="given-name" />
      </label>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <button class="btn btn-primary btn-block" disabled={busy}>Commencer</button>
    </form>
  {/if}
</main>

<style>
  .welcome {
    max-width: 440px;
    margin: 0 auto;
    padding: calc(env(safe-area-inset-top) + 12vh) var(--space-4) var(--space-6);
    text-align: center;
  }

  .logo img {
    margin: 0 auto var(--space-4);
    border-radius: 22px;
    box-shadow: var(--shadow);
  }

  h1 {
    font-size: 2rem;
    letter-spacing: -0.02em;
  }

  .tagline {
    margin: var(--space-2) 0 var(--space-6);
  }

  .form,
  .info {
    padding: var(--space-5) var(--space-4);
    text-align: left;
  }

  h2 {
    font-size: 1.15rem;
  }

  .info h2 {
    margin-bottom: var(--space-2);
  }

  .error {
    color: var(--danger);
    font-size: 0.9rem;
  }
</style>
