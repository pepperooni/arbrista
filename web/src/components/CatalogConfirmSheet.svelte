<script lang="ts">
  import type { CatalogPlant } from '../../../src/shared/plant-catalog.ts'
  import { EXPOSURE_LABELS } from '../lib/format.ts'
  import { fetchPlantPhotos } from '../lib/plant-photos.ts'
  import type { PlantPhotos } from '../lib/plant-photos.ts'
  import Sheet from './Sheet.svelte'

  let {
    plant,
    onconfirm,
    oncancel,
  }: { plant: CatalogPlant | null; onconfirm: (p: CatalogPlant) => void; oncancel: () => void } = $props()

  let photos = $state<PlantPhotos | null | 'loading'>('loading')

  $effect(() => {
    const p = plant
    if (!p) return
    photos = 'loading'
    fetchPlantPhotos(p).then((found) => {
      if (plant === p) photos = found
    })
  })
</script>

<Sheet open={plant !== null} onclose={oncancel} title="Est-ce bien cette plante ?">
  {#if plant}
    <div class="head">
      <strong>{plant.name}</strong>
      <span class="sci">{plant.scientificName}</span>
    </div>

    {#if photos === 'loading'}
      <div class="gallery" aria-busy="true">
        <div class="ph loading"></div>
        <div class="ph loading"></div>
      </div>
    {:else if photos}
      <div class="gallery" role="group" aria-label="Photos de {plant.name}">
        {#each photos.images as src, i (src)}
          <img class="ph" {src} alt="{plant.name}, photo {i + 1}" loading="lazy" referrerpolicy="no-referrer" />
        {/each}
      </div>
      <p class="credit">
        Photos : Wikimedia Commons, via <a href={photos.pageUrl} target="_blank" rel="noopener">Wikipédia</a>. Il peut s'agir d'une
        variété voisine.
      </p>
    {:else}
      <p class="muted nophoto">Aucune photo disponible pour cette plante. Vérifiez avec la description ci-dessous.</p>
    {/if}

    <p class="desc">{plant.description}</p>
    <p class="muted small">{EXPOSURE_LABELS[plant.care.exposure]} · {plant.care.temperature}</p>

    <button class="btn btn-primary btn-block" onclick={() => plant && onconfirm(plant)}>Oui, remplir la fiche</button>
    <button class="btn btn-ghost btn-block" onclick={oncancel}>Non, chercher une autre plante</button>
  {/if}
</Sheet>

<style>
  .head {
    display: flex;
    flex-direction: column;
    margin-top: calc(-1 * var(--space-2));
  }

  .head strong {
    font-size: 1.2rem;
  }

  .sci {
    font-style: italic;
    color: var(--text-muted);
  }

  .gallery {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    margin: 0 calc(-1 * var(--space-4));
    padding: 0 var(--space-4);
    scroll-padding-inline: var(--space-4);
    scrollbar-width: none;
  }

  .ph {
    flex: none;
    width: 72%;
    max-width: 280px;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: 12px;
    background: var(--surface-2);
    scroll-snap-align: start;
  }

  .loading {
    background: linear-gradient(90deg, var(--surface-2), var(--surface), var(--surface-2));
    background-size: 200% 100%;
    animation: shimmer 1s linear infinite;
  }

  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }

  .credit,
  .small {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .credit a {
    text-decoration: underline;
  }

  .desc {
    font-size: 0.95rem;
  }

  .nophoto {
    padding: var(--space-3);
    border-radius: 12px;
    background: var(--surface-2);
    font-size: 0.9rem;
  }
</style>
