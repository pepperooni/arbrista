<script lang="ts">
  import type { PlantDetailDto, RoomDto, WateringDto } from '../../../src/shared/api-types.ts'
  import CareChips from '../components/CareChips.svelte'
  import Icon from '../components/Icon.svelte'
  import Sheet from '../components/Sheet.svelte'
  import { api, errorMessage } from '../lib/api.ts'
  import { dueLabel, formatDay, formatDayTime, formatRhythm, localToday } from '../lib/format.ts'
  import { back, navigate } from '../lib/router.svelte.ts'
  import { session } from '../lib/session.svelte.ts'
  import { showToast } from '../lib/toast.svelte.ts'

  let { id }: { id: string } = $props()

  let plant = $state<PlantDetailDto | null>(null)
  let rooms = $state<RoomDto[]>([])
  let error = $state('')
  let confirmDelete = $state(false)
  let watering = $state(false)
  let shown = $state<string | null>(null)
  const today = localToday()

  async function load() {
    try {
      ;[plant, rooms] = await Promise.all([api.get<PlantDetailDto>(`/plants/${id}`), api.get<RoomDto[]>('/rooms')])
    } catch (e) {
      error = errorMessage(e)
    }
  }
  load()

  const roomName = $derived(plant?.roomId ? (rooms.find((r) => r.id === plant!.roomId)?.name ?? 'Logement') : 'Logement')
  const hero = $derived(shown ?? plant?.photos.find((p) => p.isMain)?.url ?? null)
  const due = $derived(plant ? dueLabel(plant, today) : null)
  const localDay = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const wateredToday = $derived(!!plant?.history[0] && localDay(plant.history[0].at) === today)

  /** Optimistic: the screen reacts at once, the server confirms in the background. */
  async function waterNow() {
    if (!plant || watering) return
    const name = plant.name
    const pending: WateringDto = { id: 'pending', plantId: id, occupantName: session.occupant?.name ?? 'vous', at: new Date().toISOString() }
    plant.history = [pending, ...plant.history]
    watering = true
    showToast(`${name} arrosée`)
    try {
      const w = await api.post<WateringDto>(`/plants/${id}/waterings`)
      showToast(`${name} arrosée`, {
        label: 'Annuler',
        run: async () => {
          await api.del(`/waterings/${w.id}`).catch((e) => showToast(errorMessage(e)))
          await load()
        },
      })
      await load() // refreshes the next due date
    } catch (e) {
      if (plant) plant.history = plant.history.filter((h) => h !== pending)
      showToast(errorMessage(e))
    } finally {
      watering = false
    }
  }

  async function remove() {
    try {
      await api.del(`/plants/${id}`)
      showToast(`${plant?.name} supprimée`)
      navigate('/plants', { replace: true })
    } catch (e) {
      showToast(errorMessage(e))
    }
  }
</script>

<main class="detail">
  <div class="hero">
    {#if hero}
      <img src={hero} alt={plant?.name ?? ''} />
    {:else}
      <div class="hero-empty thumb-placeholder"><Icon name="sprout" size={64} /></div>
    {/if}
    <div class="hero-bar">
      <button class="icon-btn glass" aria-label="Retour" onclick={() => back('/plants')}><Icon name="back" /></button>
      {#if plant}
        <button class="icon-btn glass" aria-label="Modifier" onclick={() => navigate(`/plants/${id}/edit`)}><Icon name="pencil" size={20} /></button>
      {/if}
    </div>
  </div>

  <div class="body">
    {#if error}
      <p class="muted">{error}</p>
    {:else if plant}
      {#if plant.photos.length > 1}
        <div class="carousel" role="group" aria-label="Photos">
          {#each plant.photos as photo (photo.id)}
            <button class="thumb" aria-pressed={hero === photo.url} aria-label="Afficher la photo" onclick={() => (shown = photo.url)}>
              <img src={photo.url} alt="" loading="lazy" />
            </button>
          {/each}
        </div>
      {/if}

      <header>
        <h1>{plant.name}</h1>
        {#if plant.scientificName}<p class="sci">{plant.scientificName}</p>{/if}
        <p class="room"><Icon name="door" size={16} /> {roomName}</p>
      </header>

      <section class="card next">
        <div>
          <span class="muted small">Prochain arrosage, idéalement</span>
          {#if wateredToday && plant.nextDue <= today}
            <strong class="muted" aria-busy="true">…</strong>
          {:else}
            <strong>{formatDay(plant.nextDue, today)}</strong>
            <span class="muted grouped">
              {#if plant.queueFrom <= today}
                dans la file depuis {formatDay(plant.queueFrom, today)}
              {:else if plant.queueFrom === plant.urgentFrom}
                dans la file et urgente {formatDay(plant.queueFrom, today)}
              {:else}
                dans la file dès {formatDay(plant.queueFrom, today)}, urgente {formatDay(plant.urgentFrom, today)}
              {/if}
            </span>
          {/if}
          {#if due?.tone === 'warn' && !wateredToday}<span class="badge badge-warn">{due.text}</span>{/if}
        </div>
        {#if wateredToday}
          <span class="btn done" role="status"><Icon name="check" size={20} /> Arrosée</span>
        {:else}
          <button class="btn btn-water" onclick={waterNow}><Icon name="droplet" size={20} /> Arroser</button>
        {/if}
      </section>

      <section class="card block">
        <h2 class="block-title"><Icon name="calendar" size={18} /> Rythme</h2>
        {#if plant.winterRhythm}
          <p><span class="muted">Été :</span> {formatRhythm(plant.summerRhythm)}</p>
          <p><span class="muted">Hiver :</span> {formatRhythm(plant.winterRhythm)}</p>
        {:else}
          <p>{formatRhythm(plant.summerRhythm)}</p>
        {/if}
      </section>

      {#if plant.care.exposure || plant.care.humidity || plant.care.temperature || plant.care.watering || plant.care.notes}
        <section class="card block">
          <h2 class="block-title"><Icon name="sprout" size={18} /> Entretien</h2>
          <CareChips care={plant.care} />
          {#if plant.care.watering}<p><span class="muted">Arrosage :</span> {plant.care.watering}</p>{/if}
          {#if plant.care.notes}<p class="pre">{plant.care.notes}</p>{/if}
        </section>
      {/if}

      {#if plant.description}
        <section class="card block">
          <h2 class="block-title">Description</h2>
          <p class="pre">{plant.description}</p>
        </section>
      {/if}

      <section class="card block">
        <h2 class="block-title"><Icon name="clock" size={18} /> Historique</h2>
        {#if plant.history.length === 0}
          <p class="muted">Pas encore arrosée.</p>
        {:else}
          <ul class="history">
            {#each plant.history as w (w.id)}
              <li><strong>{w.occupantName}</strong> <span class="muted">{formatDayTime(w.at)}</span></li>
            {/each}
          </ul>
        {/if}
      </section>

      <button class="btn btn-danger btn-block" onclick={() => (confirmDelete = true)}><Icon name="trash" size={18} /> Supprimer la plante</button>
    {/if}
  </div>
</main>

<Sheet bind:open={confirmDelete} title="Supprimer {plant?.name ?? 'la plante'} ?">
  <p class="muted">Ses photos et son historique d'arrosage seront définitivement supprimés.</p>
  <button class="btn btn-block delete" onclick={remove}>Supprimer</button>
  <button class="btn btn-ghost btn-block" onclick={() => (confirmDelete = false)}>Annuler</button>
</Sheet>

<style>
  .detail {
    max-width: var(--content-max);
    margin: 0 auto;
    padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom) + var(--space-6));
  }

  .hero {
    position: relative;
    aspect-ratio: 4 / 3;
    max-height: 60dvh;
    overflow: hidden;
    background: var(--surface-2);
  }

  .hero img,
  .hero-empty {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-bar {
    position: absolute;
    inset: calc(env(safe-area-inset-top) + var(--space-3)) var(--space-3) auto;
    display: flex;
    justify-content: space-between;
  }

  .glass {
    background: rgb(255 255 255 / 85%);
    color: #17231b;
    backdrop-filter: blur(6px);
  }

  .body {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .carousel {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    margin: calc(-1 * var(--space-2)) 0 0;
  }

  .thumb {
    flex: none;
    width: 64px;
    height: 64px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 12px;
    overflow: hidden;
    scroll-snap-align: start;
    cursor: pointer;
  }

  .thumb[aria-pressed='true'] {
    border-color: var(--accent);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  h1 {
    font-size: 1.7rem;
    letter-spacing: -0.02em;
  }

  .sci {
    font-style: italic;
    color: var(--text-muted);
  }

  .room {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: var(--space-1);
    color: var(--text-muted);
    font-size: 0.92rem;
  }

  .next {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .next div {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .next strong {
    font-size: 1.15rem;
    text-transform: capitalize;
  }

  .grouped {
    font-size: 0.85rem;
  }

  .small {
    font-size: 0.85rem;
  }

  .block {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .block-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 1rem;
  }

  .pre {
    white-space: pre-line;
  }

  .history {
    padding: 0;
    margin: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .history li {
    display: flex;
    justify-content: space-between;
  }

  .done {
    background: var(--accent-soft);
    color: var(--accent-strong);
    cursor: default;
  }

  .delete {
    background: var(--danger);
    color: #fff;
  }
</style>
