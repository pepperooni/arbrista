<script lang="ts">
  import type { CatalogPlant } from '../../../src/shared/plant-catalog.ts'
  import { errorMessage } from '../lib/api.ts'
  import { downloadLibraryPhoto, fetchPlantPhotos } from '../lib/plant-photos.ts'
  import type { PlantPhotos } from '../lib/plant-photos.ts'
  import { showToast } from '../lib/toast.svelte.ts'
  import Icon from './Icon.svelte'

  /** Offers the library pictures of the plant as photos, instead of taking one. */
  let { plant, onadd }: { plant: CatalogPlant; onadd: (photo: Blob) => Promise<void> } = $props()

  let expanded = $state(false)
  let photos = $state<PlantPhotos | null | 'loading'>('loading')
  let busy = $state<string | null>(null)
  let added = $state<string[]>([])

  async function expand() {
    expanded = true
    photos = 'loading'
    photos = await fetchPlantPhotos(plant)
  }

  async function use(src: string) {
    if (busy || added.includes(src)) return
    busy = src
    try {
      await onadd(await downloadLibraryPhoto(src))
      added = [...added, src]
      showToast('Image ajoutée aux photos de la plante')
    } catch (e) {
      showToast(`Impossible de récupérer cette image : ${errorMessage(e)}`)
    } finally {
      busy = null
    }
  }
</script>

<div class="library-photos">
  {#if !expanded}
    <button type="button" class="btn btn-block" onclick={expand}>
      <Icon name="sprout" size={20} /> Utiliser une image de la bibliothèque
    </button>
  {:else if photos === 'loading'}
    <p class="muted small" aria-busy="true">Recherche des images de « {plant.name} »…</p>
  {:else if photos === null || photos.images.length === 0}
    <p class="muted small">Aucune image disponible pour « {plant.name} ».</p>
  {:else}
    <p class="muted small">Touchez une image de « {plant.name} » pour l'utiliser comme photo de la plante :</p>
    <div class="row" role="group" aria-label="Images de la bibliothèque">
      {#each photos.images as src, i (src)}
        <button
          type="button"
          class="thumb"
          class:added={added.includes(src)}
          aria-label="Utiliser l'image {i + 1}"
          aria-busy={busy === src}
          onclick={() => use(src)}
        >
          <img {src} alt="" loading="lazy" referrerpolicy="no-referrer" />
          {#if added.includes(src)}<span class="tick"><Icon name="check" size={18} /></span>{/if}
          {#if busy === src}<span class="tick busy">…</span>{/if}
        </button>
      {/each}
    </div>
    <p class="credit">Images : Wikimedia Commons, via <a href={photos.pageUrl} target="_blank" rel="noopener">Wikipédia</a>.</p>
  {/if}
</div>

<style>
  .library-photos {
    margin-top: var(--space-3);
  }

  .small {
    font-size: 0.9rem;
  }

  .row {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    margin-top: var(--space-2);
    scrollbar-width: none;
  }

  .thumb {
    position: relative;
    flex: none;
    width: 96px;
    height: 96px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 12px;
    overflow: hidden;
    background: var(--surface-2);
    cursor: pointer;
  }

  .thumb.added {
    border-color: var(--accent);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .tick {
    position: absolute;
    right: 4px;
    bottom: 4px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 700;
  }

  .tick.busy {
    background: rgb(0 0 0 / 55%);
    color: #fff;
  }

  .credit {
    margin-top: var(--space-2);
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .credit a {
    text-decoration: underline;
  }
</style>
