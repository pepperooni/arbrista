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
  let deviceCode = $state('')
  let codeError = $state('')
  let invite = $state('')
  let inviteError = $state('')

  /** Signs this device in as an existing occupant, with a code shown on an already signed-in device. */
  async function claim(e: SubmitEvent) {
    e.preventDefault()
    busy = true
    codeError = ''
    try {
      const auth = await api.post<AuthDto>('/devices/claim', { code: deviceCode })
      signIn(auth.token, auth.occupant)
      navigate('/', { replace: true })
    } catch (err) {
      codeError = errorMessage(err)
    } finally {
      busy = false
    }
  }

  /** Accepts a pasted invitation link (…/join/<code>) or the bare code. */
  function openInvite(e: SubmitEvent) {
    e.preventDefault()
    const code = invite.trim().match(/\/join\/([^/?#\s]+)/)?.[1] ?? invite.trim()
    if (!/^[\w-]{6,}$/.test(code)) {
      inviteError = "Ce lien d'invitation n'est pas reconnu"
      return
    }
    navigate(`/join/${encodeURIComponent(code)}`)
  }

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
    <form class="card stack form" onsubmit={claim}>
      <h2>Déjà membre du logement ?</h2>
      <p class="muted small">
        Sur un appareil où vous êtes connecté, ouvrez <strong>Logement → Connecter un autre appareil</strong> et saisissez le code ici.
      </p>
      <label class="field">
        <span>Code de connexion</span>
        <input
          class="input code"
          bind:value={deviceCode}
          placeholder="ABCD-EFGH"
          required
          maxlength="12"
          autocomplete="one-time-code"
          autocapitalize="characters"
          spellcheck="false"
        />
      </label>
      {#if codeError}<p class="error" role="alert">{codeError}</p>{/if}
      <button class="btn btn-primary btn-block" disabled={busy}>Se connecter</button>
    </form>

    <form class="card stack form" onsubmit={openInvite}>
      <h2>Nouvel occupant ?</h2>
      <p class="muted small">Collez le lien d'invitation reçu d'un occupant (onglet <strong>Logement → Inviter</strong>).</p>
      <label class="field">
        <span>Lien d'invitation</span>
        <input class="input" bind:value={invite} placeholder="https://…/join/…" required autocomplete="off" spellcheck="false" />
      </label>
      {#if inviteError}<p class="error" role="alert">{inviteError}</p>{/if}
      <button class="btn btn-block">Rejoindre le logement</button>
    </form>
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

  .form {
    padding: var(--space-5) var(--space-4);
    text-align: left;
    margin-bottom: var(--space-4);
  }

  .small {
    font-size: 0.92rem;
  }

  .code {
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h2 {
    font-size: 1.15rem;
  }


  .error {
    color: var(--danger);
    font-size: 0.9rem;
  }
</style>
