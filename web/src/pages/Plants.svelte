<script lang="ts">
  import type { PlantSummaryDto, RoomDto } from '../../../src/shared/api-types.ts'
  import Icon from '../components/Icon.svelte'
  import RoomFilter from '../components/RoomFilter.svelte'
  import { api, errorMessage } from '../lib/api.ts'
  import { dueLabel, localToday, normalize } from '../lib/format.ts'
  import { link, navigate } from '../lib/router.svelte.ts'

  let plants = $state<PlantSummaryDto[] | null>(null)
  let rooms = $state<RoomDto[]>([])
  let error = $state('')
  let query = $state('')
  let room = $state<string | null>(null)
  const today = localToday()

  Promise.all([api.get<PlantSummaryDto[]>('/plants'), api.get<RoomDto[]>('/rooms')])
    .then(([p, r]) => {
      plants = p
      rooms = r
    })
    .catch((e) => (error = errorMessage(e)))

  const visible = $derived(
    (plants ?? []).filter((p) => {
      if (room !== null && (p.roomId ?? '') !== room) return false
      const q = normalize(query.trim())
      return !q || normalize(p.name).includes(q) || normalize(p.scientificName ?? '').includes(q)
    }),
  )
</script>

<main class="page">
  <header class="page-header">
    <h1>Plantes</h1>
  </header>

  {#if error}
    <p class="muted">{error}</p>
  {:else if plants && plants.length === 0}
    <div class="empty card">
      <div class="emoji">🪴</div>
      <h2>Aucune plante pour l'instant</h2>
      <p class="muted">Ajoutez votre première plante pour commencer le suivi.</p>
      <button class="btn btn-primary first" onclick={() => navigate('/plants/new')}><Icon name="plus" /> Ajouter une plante</button>
    </div>
  {:else if plants}
    <label class="search">
      <Icon name="search" size={20} />
      <input type="search" placeholder="Rechercher une plante" bind:value={query} aria-label="Rechercher une plante" />
    </label>
    {#if rooms.length > 0}<RoomFilter {rooms} bind:value={room} />{/if}

    {#if visible.length === 0}
      <p class="muted none">Aucune plante ne correspond.</p>
    {:else}
      <ul class="grid">
        {#each visible as plant (plant.id)}
          {@const due = dueLabel(plant.nextDue, today)}
          <li>
            <a href="/plants/{plant.id}" use:link class="tile card">
              {#if plant.mainPhotoUrl}
                <img src={plant.mainPhotoUrl} alt="" loading="lazy" />
              {:else}
                <div class="img thumb-placeholder"><Icon name="sprout" size={36} /></div>
              {/if}
              <div class="meta">
                <strong>{plant.name}</strong>
                <span class="badge" class:badge-warn={due.tone === 'warn'} class:badge-water={due.tone === 'water'}>{due.text}</span>
              </div>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  <a href="/plants/new" use:link class="fab" aria-label="Ajouter une plante"><Icon name="plus" size={28} /></a>
</main>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--tap);
    padding: 0 var(--space-3);
    margin-bottom: var(--space-3);
    border-radius: 999px;
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--text-muted);
  }

  .search input {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    outline: none;
    color: var(--text);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
    padding: 0;
    margin: var(--space-4) 0 0;
    list-style: none;
  }

  .tile {
    display: block;
    overflow: hidden;
  }

  .tile img,
  .tile .img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
  }

  .meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: var(--space-2) var(--space-3) var(--space-3);
  }

  .meta strong {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .none {
    margin-top: var(--space-5);
    text-align: center;
  }

  .first {
    margin-top: var(--space-4);
  }

  .fab {
    position: fixed;
    right: max(var(--space-4), calc((100vw - var(--content-max)) / 2 + var(--space-4)));
    bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom) + var(--space-4));
    z-index: 15;
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 18px;
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: 0 6px 18px rgb(47 125 79 / 35%);
  }
</style>
