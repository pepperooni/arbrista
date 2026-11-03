<script lang="ts">
  import { untrack } from 'svelte'
  import type { Care, PhotoDto, PlantDetailDto, PlantInput, RhythmInput, RoomDto } from '../../../src/shared/api-types.ts'
  import type { CatalogPlant } from '../../../src/shared/plant-catalog.ts'
  import CatalogConfirmSheet from '../components/CatalogConfirmSheet.svelte'
  import CatalogSearch from '../components/CatalogSearch.svelte'
  import IdentifySheet from '../components/IdentifySheet.svelte'
  import LibraryPhotos from '../components/LibraryPhotos.svelte'
  import type { IdentifyCandidateDto } from '../../../src/shared/api-types.ts'
  import { resizeImage } from '../lib/image.ts'
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
  let candidate = $state<CatalogPlant | null>(null)
  let fromLibrary = $state<string | null>(null)
  let careOpen = $state(false)
  // Re-creates the rhythm pickers so they show rhythms set from the library.
  let rhythmVersion = $state(0)
  let identifyAvailable = $state(false)
  // Library plant matching the scientific name: its pictures can be used as photos.
  let libraryMatch = $state<CatalogPlant | null>(null)
  $effect(() => {
    const sci = scientificName.trim()
    if (!sci) {
      libraryMatch = null
      return
    }
    const timer = setTimeout(async () => {
      const { matchCatalog } = await import('../../../src/shared/catalog.ts')
      const match = matchCatalog(sci, sci.split(/\s+/)[0])
      libraryMatch = match?.by === 'species' ? match.plant : null
    }, 300)
    return () => clearTimeout(timer)
  })
  let identifyPhoto = $state<Blob | null>(null)
  let identifyInput = $state<HTMLInputElement>()
  // Photo used for identification, added to the plant once the user confirms a candidate.
  let photoToAdd: Blob | null = null

  api
    .get<{ available: boolean }>('/identify')
    .then((r) => (identifyAvailable = r.available))
    .catch(() => {})

  async function pickIdentifyPhoto(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (identifyInput) identifyInput.value = ''
    if (!file) return
    try {
      identifyPhoto = await resizeImage(file)
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  /** Uploads now when editing, or keeps it for after creation; throws if the upload fails. */
  async function storePhoto(blob: Blob) {
    if (id) photos = [...photos, await api.upload<PhotoDto>(`/plants/${id}/photos`, blob)]
    else pending = [...pending, { blob, url: URL.createObjectURL(blob) }]
  }

  async function addPhotoBlob(blob: Blob | null) {
    if (!blob) return
    await storePhoto(blob).catch((err) => showToast(errorMessage(err)))
  }

  /** A candidate from photo identification: confirm it through the library when known there. */
  async function chooseIdentified(c: IdentifyCandidateDto, keepPhoto: boolean) {
    photoToAdd = keepPhoto ? identifyPhoto : null
    identifyPhoto = null
    if (c.catalogId) {
      const { PLANT_CATALOG } = await import('../../../src/shared/plant-catalog.ts')
      candidate = PLANT_CATALOG.find((p) => p.id === c.catalogId) ?? null
      if (candidate) return
    }
    if (!name.trim()) name = c.commonName ?? c.scientificName
    if (!scientificName.trim()) scientificName = c.scientificName
    const photo = photoToAdd
    photoToAdd = null
    await addPhotoBlob(photo)
    showToast("Plante absente de la bibliothèque : complétez l'entretien vous-même")
  }

  /** Confirmed library plant: fills empty fields, always applies the watering rhythms. */
  async function applyLibrary(p: CatalogPlant) {
    // Taken before closing the sheet: closing it runs the cancel handler, which drops the photo.
    const photo = photoToAdd
    photoToAdd = null
    candidate = null
    const { fillFromCatalog } = await import('../../../src/shared/catalog.ts')
    const filled = fillFromCatalog(
      { name, scientificName, description, care, summerRhythm, winterRhythm: hasWinter ? winterRhythm : null },
      p,
    )
    name = filled.name
    scientificName = filled.scientificName
    description = filled.description
    care = filled.care
    summerRhythm = filled.summerRhythm
    hasWinter = filled.winterRhythm !== null
    if (filled.winterRhythm) winterRhythm = filled.winterRhythm
    rhythmVersion++
    careOpen = true
    fromLibrary = p.name
    await addPhotoBlob(photo)
  }

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
      <section class="library">
        <CatalogSearch onpick={(p) => (candidate = p)} />
        {#if identifyAvailable}
          <button type="button" class="btn btn-block identify" onclick={() => identifyInput?.click()}>
            <Icon name="camera" size={20} /> Identifier avec une photo
          </button>
          <input bind:this={identifyInput} type="file" accept="image/*" hidden onchange={pickIdentifyPhoto} />
        {/if}
        {#if fromLibrary}
          <p class="muted hint filled" role="status">
            Fiche complétée avec « {fromLibrary} ». Les rythmes sont indicatifs : ajustez-les selon votre intérieur.
          </p>
        {/if}
      </section>

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
          {#if libraryMatch}
            {#key libraryMatch.id}
              <LibraryPhotos plant={libraryMatch} onadd={storePhoto} />
            {/key}
          {/if}
        </div>
      </details>

      <details open class="card">
        <summary>Arrosage <Icon name="chevron" size={18} /></summary>
        <div class="stack content">
          {#key rhythmVersion}
            <RhythmPicker label={hasWinter ? 'Été' : 'Rythme'} bind:value={summerRhythm} />
          {/key}
          <label class="switch">
            <input type="checkbox" bind:checked={hasWinter} />
            <span>Rythme d'hiver différent</span>
          </label>
          {#if hasWinter}
            {#key rhythmVersion}
              <RhythmPicker label="Hiver" bind:value={winterRhythm} />
            {/key}
          {/if}
        </div>
      </details>

      <details class="card" bind:open={careOpen}>
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
            <textarea class="input short" bind:value={care.watering} maxlength="500" rows="2" placeholder="Laisser sécher le substrat entre deux arrosages"></textarea>
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

<CatalogConfirmSheet
  plant={candidate}
  onconfirm={applyLibrary}
  oncancel={() => {
    candidate = null
    photoToAdd = null
  }}
/>
<IdentifySheet photo={identifyPhoto} onchoose={chooseIdentified} onclose={() => (identifyPhoto = null)} />

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

  textarea.short {
    min-height: 64px;
  }

  .identify {
    margin-top: var(--space-3);
  }

  .filled {
    margin: var(--space-2) var(--space-3) 0;
  }

  .hint {
    margin-top: var(--space-2);
    font-size: 0.85rem;
  }

  .error {
    color: var(--danger);
  }
</style>
