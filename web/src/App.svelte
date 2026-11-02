<script lang="ts">
  import TabBar from './components/TabBar.svelte'
  import Toast from './components/Toast.svelte'
  import { api } from './lib/api.ts'
  import { match, navigate, router } from './lib/router.svelte.ts'
  import { session } from './lib/session.svelte.ts'
  import Household from './pages/Household.svelte'
  import Join from './pages/Join.svelte'
  import PlantDetail from './pages/PlantDetail.svelte'
  import PlantForm from './pages/PlantForm.svelte'
  import Plants from './pages/Plants.svelte'
  import Today from './pages/Today.svelte'
  import Welcome from './pages/Welcome.svelte'

  let initialized = $state<boolean | null>(null)

  api
    .get<{ initialized: boolean }>('/setup')
    .then((r) => (initialized = r.initialized))
    .catch(() => (initialized = true))

  const joinParams = $derived(match('/join/:code'))
  const signedIn = $derived(session.token !== null)

  $effect(() => {
    if (initialized === null || joinParams) return
    if (!signedIn && router.path !== '/welcome') navigate('/welcome', { replace: true })
    if (signedIn && router.path === '/welcome') navigate('/', { replace: true })
  })
</script>

{#if joinParams}
  <Join code={joinParams.code} />
{:else if initialized === null}
  <div class="boot" aria-busy="true"></div>
{:else if !signedIn}
  <Welcome {initialized} />
{:else}
  {#key router.path}
    {#if router.path === '/'}
      <Today />
    {:else if router.path === '/plants'}
      <Plants />
    {:else if router.path === '/plants/new'}
      <PlantForm />
    {:else if match('/plants/:id/edit')}
      <PlantForm id={match('/plants/:id/edit')!.id} />
    {:else if match('/plants/:id')}
      <PlantDetail id={match('/plants/:id')!.id} />
    {:else if router.path === '/household'}
      <Household />
    {:else}
      <main class="page empty">
        <div class="emoji">🪴</div>
        <h2>Page introuvable</h2>
        <button class="btn btn-primary" onclick={() => navigate('/')}>Retour à l'accueil</button>
      </main>
    {/if}
  {/key}
  <TabBar />
{/if}
<Toast />

<style>
  .boot {
    min-height: 100dvh;
  }
</style>
