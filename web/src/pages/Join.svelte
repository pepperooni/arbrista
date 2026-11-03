<script lang="ts">
  import type { AuthDto } from '../../../src/shared/api-types.ts'
  import { api, errorMessage } from '../lib/api.ts'
  import { navigate } from '../lib/router.svelte.ts'
  import { session, signIn } from '../lib/session.svelte.ts'

  let { code }: { code: string } = $props()

  let occupantName = $state('')
  let error = $state('')
  let busy = $state(false)

  async function join(e: SubmitEvent) {
    e.preventDefault()
    busy = true
    error = ''
    try {
      const auth = await api.post<AuthDto>(`/join/${encodeURIComponent(code)}`, { occupantName })
      signIn(auth.token, auth.occupant)
      navigate('/', { replace: true })
    } catch (err) {
      error = errorMessage(err)
    } finally {
      busy = false
    }
  }
</script>

<main class="join">
  <img src="/icon.svg" alt="" width="72" height="72" />
  <h1>Bienvenue !</h1>
  <p class="muted">Vous avez été invité à suivre l'arrosage des plantes du logement.</p>

  {#if session.occupant}
    <p class="already">
      Vous êtes déjà connecté en tant que <strong>{session.occupant.name}</strong>.
      <button class="btn btn-ghost" onclick={() => navigate('/', { replace: true })}>Continuer</button>
    </p>
  {/if}

  <form class="card stack form" onsubmit={join}>
    <label class="field">
      <span>Votre prénom</span>
      <input class="input" bind:value={occupantName} placeholder="Tom" required maxlength="60" autocomplete="given-name" />
    </label>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button class="btn btn-primary btn-block" disabled={busy}>Rejoindre</button>
  </form>
</main>

<style>
  .join {
    max-width: 440px;
    margin: 0 auto;
    padding: calc(env(safe-area-inset-top) + 10vh) var(--space-4) var(--space-6);
    text-align: center;
  }

  img {
    margin: 0 auto var(--space-4);
    border-radius: 18px;
  }

  h1 {
    font-size: 1.75rem;
    margin-bottom: var(--space-2);
  }

  .already {
    margin-top: var(--space-4);
  }

  .form {
    margin-top: var(--space-5);
    padding: var(--space-5) var(--space-4);
    text-align: left;
  }

  .error {
    color: var(--danger);
    font-size: 0.9rem;
  }
</style>
