<script lang="ts">
  import { untrack } from 'svelte'
  import type { Care, PhotoDto, PlantDetailDto, PlantInput, RhythmInput, RoomDto } from '../../../src/shared/api-types.ts'
  import Icon from '../components/Icon.svelte'
  import PhotoManager from '../components/PhotoManager.svelte'
  import RhythmPicker from '../components/RhythmPicker.svelte'
  import { api, errorMessage } from '../lib/api.ts'
  import { EXPOSURE_LABELS, HUMIDITY_LABELS } from '../lib/format.ts'
  import { back, navigate } from '../lib/router.svelte.ts'
  import { showToast } from '../lib/toast.svelte.ts'

  let { id: idProp }: { id?: string } = $props()
  // The page is re-created on every route change (keyed in App), so the id never changes here.
  const id = untrack(() => idProp)

  type Rhythm = PlantDetailDto['summerRhythm']
  const toInput = (r: Rhythm): RhythmInput =>
    r.kind === 'weekly' ? { kind: 'weekly', days: r.days, everyWeeks: r.everyWeeks } : { kind: 'interval', everyDays: r.everyDays }

  let loaded = $state(!id)
  let rooms = $state<RoomDto[]>([])
  let name = $state('')
  let scientificName = $state('')
  let description = $state('')
  let roomId = $state('')
  let care = $state<Care>({})
  let summerRhythm = $state<RhythmInput>({ kind: 'interval', everyDays: 7 })
  let winterRhythm = $state<RhythmInput>({ kind: 'interval', everyDays: 14 })
  let hasWinter = $state(false)
  let photos = $state<PhotoDto[]>([])
  let pending = $state<{ blob: Blob; url: string }[]>([])
  let saving = $state(false)
  let error = $state('')

  api.get<RoomDto[]>('/rooms').then((r) => (rooms = r)).catch(() => {})

  if (id) {
    api
      .get<PlantDetailDto>(`/plants/${id}`)
      .then((p) => {
        name = p.name
        scientificName = p.scientificName ?? ''
        description = p.description ?? ''
        roomId = p.roomId ?? ''
        care = { ...p.care }
        summerRhythm = toInput(p.summerRhythm)
        if (p.winterRhythm) {
          hasWinter = true
          winterRhythm = toInput(p.winterRhythm)
        }
        photos = p.photos
        loaded = true
      })
      .catch((e) => (error = errorMessage(e)))
  }

  function toggle<K extends 'exposure' | 'humidity'>(key: K, value: NonNullable<Care[K]>) {
    care[key] = care[key] === value ? undefined : value
  }

  async function save(e: SubmitEvent) {
    e.preventDefault()
    saving = true
    error = ''
    const input: PlantInput = {
      name,
      scientificName: scientificName || null,
      description: description || null,
      roomId: roomId || null,
      care: Object.fromEntries(Object.entries(care).filter(([, v]) => v)),
      summerRhythm,
      winterRhythm: hasWinter ? winterRhythm : null,
    }
    try {
      const plant = id ? await api.patch<PlantDetailDto>(`/plants/${id}`, input) : await api.post<PlantDetailDto>('/plants', input)
      for (const p of pending) {
        await api.upload(`/plants/${plant.id}/photos`, p.blob).catch((err) => showToast(errorMessage(err)))
        URL.revokeObjectURL(p.url)
      }
      showToast(id ? 'Modifications enregistrées' : `${plant.name} ajoutée`)
      navigate(`/plants/${plant.id}`, { replace: true })
    } catch (err) {
      error = errorMessage(err)
    } finally {
      saving = false
    }
  }
</script>

<main class="page">
  <header class="page-header">
    <button class="icon-btn" aria-label="Retour" onclick={() => back(id ? `/plants/${id}` : '/plants')}><Icon name="back" /></button>
    <h1>{id ? 'Modifier' : 'Nouvelle plante'}</h1>
  </header>

  {#if loaded}
    <form class="stack" onsubmit={save}>
      <details open class="card">
        <summary>Identité <Icon name="chevron" size={18} /></summary>
        <div class="stack content">
          <label class="field">
            <span>Nom *</span>
            <input class="input" bind:value={name} required maxlength="80" placeholder="Monstera" />
          </label>
          <label class="field">
            <span>Nom scientifique</span>
            <input class="input sci" bind:value={scientificName} maxlength="120" placeholder="Monstera deliciosa" />
          </label>
          <label class="field">
            <span>Pièce</span>
            <select class="input" bind:value={roomId}>
              <option value="">Logement (aucune pièce)</option>
              {#each rooms as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
            </select>
          </label>
          <label class="field">
            <span>Description</span>
            <textarea class="input" bind:value={description} maxlength="2000" rows="3"></textarea>
          </label>
        </div>
      </details>

      <details open class="card">
        <summary>Photos <Icon name="chevron" size={18} /></summary>
        <div class="content">
          <PhotoManager plantId={id ?? null} bind:photos bind:pending />
          <p class="muted hint">La photo marquée d'une étoile identifie la plante.</p>
        </div>
      </details>

      <details open class="card">
        <summary>Arrosage <Icon name="chevron" size={18} /></summary>
        <div class="stack content">
          <RhythmPicker label={hasWinter ? 'Été' : 'Rythme'} bind:value={summerRhythm} />
          <label class="switch">
            <input type="checkbox" bind:checked={hasWinter} />
            <span>Rythme d'hiver différent</span>
          </label>
          {#if hasWinter}
            <RhythmPicker label="Hiver" bind:value={winterRhythm} />
          {/if}
        </div>
      </details>

      <details class="card">
        <summary>Entretien <Icon name="chevron" size={18} /></summary>
        <div class="stack content">
          <div class="field">
            <span>Exposition</span>
            <div class="options">
              {#each Object.entries(EXPOSURE_LABELS) as [value, label] (value)}
                <button type="button" class="chip" aria-pressed={care.exposure === value} onclick={() => toggle('exposure', value as keyof typeof EXPOSURE_LABELS)}>{label}</button>
              {/each}
            </div>
          </div>
          <div class="field">
            <span>Humidité</span>
            <div class="options">
              {#each Object.entries(HUMIDITY_LABELS) as [value, label] (value)}
                <button type="button" class="chip" aria-pressed={care.humidity === value} onclick={() => toggle('humidity', value as keyof typeof HUMIDITY_LABELS)}>{label}</button>
              {/each}
            </div>
          </div>
          <label class="field">
            <span>Conseils d'arrosage</span>
            <input class="input" bind:value={care.watering} maxlength="500" placeholder="Laisser sécher le substrat entre deux arrosages" />
          </label>
          <label class="field">
            <span>Température</span>
            <input class="input" bind:value={care.temperature} maxlength="100" placeholder="15–24 °C" />
          </label>
          <label class="field">
            <span>Notes</span>
            <textarea class="input" bind:value={care.notes} maxlength="2000" rows="3"></textarea>
          </label>
        </div>
      </details>

      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <button class="btn btn-primary btn-block" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>
  {:else if error}
    <p class="muted">{error}</p>
  {/if}
</main>

<style>
  details {
    overflow: hidden;
  }

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 0 var(--space-4);
    font-weight: 700;
    cursor: pointer;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  details[open] summary :global(svg) {
    transform: rotate(180deg);
  }

  .content {
    padding: 0 var(--space-4) var(--space-4);
  }

  .sci {
    font-style: italic;
  }

  .options {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .switch {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap);
    font-weight: 600;
  }

  .switch input {
    width: 22px;
    height: 22px;
    accent-color: var(--accent);
  }

  .hint {
    margin-top: var(--space-2);
    font-size: 0.85rem;
  }

  .error {
    color: var(--danger);
  }
</style>
