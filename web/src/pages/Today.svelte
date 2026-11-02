<script lang="ts">
  import type { SessionDto, SessionItemDto, WateringDto } from '../../../src/shared/api-types.ts'
  import ProgressBar from '../components/ProgressBar.svelte'
  import SessionCard from '../components/SessionCard.svelte'
  import { api, errorMessage } from '../lib/api.ts'
  import { formatDay, plural } from '../lib/format.ts'
  import { session as auth } from '../lib/session.svelte.ts'
  import { showToast } from '../lib/toast.svelte.ts'

  let data = $state<SessionDto | null>(null)
  let error = $state('')

  async function load() {
    try {
      data = await api.get<SessionDto>('/session/today')
      error = ''
    } catch (e) {
      error = errorMessage(e)
    }
  }

  load()

  $effect(() => {
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  })

  const done = $derived(data ? data.total - data.pending : 0)

  const groups = $derived.by(() => {
    const map = new Map<string, SessionItemDto[]>()
    for (const item of data?.items ?? []) {
      const key = item.roomName ?? 'Logement'
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.entries()]
  })

  function setDone(plantId: string, value: SessionItemDto['done']) {
    if (!data) return
    const item = data.items.find((i) => i.plantId === plantId)
    if (!item) return
    const wasDone = item.done !== null
    item.done = value
    if (wasDone !== (value !== null)) data.pending += value ? -1 : 1
  }

  async function undo(wateringIds: string[]) {
    try {
      await Promise.all(wateringIds.map((id) => api.del(`/waterings/${id}`)))
    } catch (e) {
      showToast(errorMessage(e))
    }
    await load()
  }

  async function water(items: SessionItemDto[]) {
    const optimistic = { wateringId: '', occupantName: auth.occupant?.name ?? 'vous', at: new Date().toISOString() }
    for (const item of items) setDone(item.plantId, { ...optimistic })

    const results = await Promise.allSettled(items.map((item) => api.post<WateringDto>(`/plants/${item.plantId}/waterings`)))
    const ids: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        setDone(items[i].plantId, { wateringId: r.value.id, occupantName: r.value.occupantName, at: r.value.at })
        ids.push(r.value.id)
      } else {
        setDone(items[i].plantId, null)
      }
    })

    if (ids.length < items.length) {
      showToast("Impossible d'enregistrer l'arrosage")
      return
    }
    const label = items.length === 1 ? `${items[0].name} arrosée` : `${items.length} plantes arrosées`
    showToast(label, { label: 'Annuler', run: () => undo(ids) })
    await load() // refreshes the next-session preview, which depends on today's waterings
  }

  const pendingItems = $derived(data?.items.filter((i) => i.done === null) ?? [])
</script>

<main class="page">
  <header class="page-header">
    <h1>Aujourd'hui</h1>
  </header>

  {#if error && !data}
    <div class="empty card">
      <div class="emoji">📡</div>
      <h2>Connexion impossible</h2>
      <p class="muted">{error}</p>
      <button class="btn btn-primary retry" onclick={load}>Réessayer</button>
    </div>
  {:else if data}
    {#if data.total === 0}
      <div class="empty card">
        <div class="emoji">🌱</div>
        <h2>Rien à arroser aujourd'hui</h2>
        {@render nextSession()}
      </div>
    {:else}
      <section class="summary card">
        <div class="summary-text">
          {#if data.pending > 0}
            <strong>{plural(data.pending, 'plante à arroser', 'plantes à arroser')}</strong>
          {:else}
            <strong>Tout est arrosé 🌱</strong>
          {/if}
          <span class="muted">{done}/{data.total}</span>
        </div>
        <ProgressBar {done} total={data.total} />
        {#if data.pending === 0}{@render nextSession()}{/if}
      </section>

      {#if pendingItems.length > 1}
        <button class="btn btn-water btn-block all" onclick={() => water(pendingItems)}>Tout arroser</button>
      {/if}

      {#each groups as [room, items] (room)}
        <h2 class="section-title">{room}</h2>
        <ul class="stack list">
          {#each items as item (item.plantId)}
            <SessionCard {item} onWater={(i) => water([i])} />
          {/each}
        </ul>
      {/each}
    {/if}
  {/if}
</main>

{#snippet nextSession()}
  {#if data?.next}
    <p class="muted next">
      Prochaine session : <strong>{formatDay(data.next.date, data.date)}</strong> · {plural(data.next.count, 'plante', 'plantes')}
    </p>
  {/if}
{/snippet}

<style>
  .summary {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .summary-text {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 1.1rem;
  }

  .all {
    margin-top: var(--space-3);
  }

  .list {
    padding: 0;
    margin: 0;
  }

  .next {
    font-size: 0.95rem;
  }

  .empty .next {
    margin-top: var(--space-2);
  }

  .retry {
    margin-top: var(--space-4);
  }
</style>
