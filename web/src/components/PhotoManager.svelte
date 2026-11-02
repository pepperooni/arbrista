<script lang="ts">
  import type { PhotoDto } from '../../../src/shared/api-types.ts'
  import { api, errorMessage } from '../lib/api.ts'
  import { resizeImage } from '../lib/image.ts'
  import { showToast } from '../lib/toast.svelte.ts'
  import Icon from './Icon.svelte'

  /**
   * With a plantId, photos are uploaded right away. Without one (new plant), they are kept
   * in `pending` and uploaded by the form once the plant exists; the first one becomes main.
   */
  let {
    plantId = null,
    photos = $bindable([]),
    pending = $bindable([]),
  }: { plantId?: string | null; photos?: PhotoDto[]; pending?: { blob: Blob; url: string }[] } = $props()

  let uploading = $state(0)
  let input: HTMLInputElement

  async function pick(e: Event) {
    const files = [...((e.target as HTMLInputElement).files ?? [])]
    input.value = ''
    for (const file of files) {
      uploading++
      try {
        const blob = await resizeImage(file)
        if (plantId) photos = [...photos, await api.upload<PhotoDto>(`/plants/${plantId}/photos`, blob)]
        else pending = [...pending, { blob, url: URL.createObjectURL(blob) }]
      } catch (err) {
        showToast(errorMessage(err))
      } finally {
        uploading--
      }
    }
  }

  async function makeMain(photo: PhotoDto) {
    try {
      await api.post(`/photos/${photo.id}/main`)
      photos = photos.map((p) => ({ ...p, isMain: p.id === photo.id }))
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  async function remove(photo: PhotoDto) {
    try {
      await api.del(`/photos/${photo.id}`)
      const rest = photos.filter((p) => p.id !== photo.id)
      if (photo.isMain && rest.length && !rest.some((p) => p.isMain)) rest[0] = { ...rest[0], isMain: true }
      photos = rest
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  function makePendingMain(i: number) {
    pending = [pending[i], ...pending.filter((_, j) => j !== i)]
  }

  function removePending(i: number) {
    URL.revokeObjectURL(pending[i].url)
    pending = pending.filter((_, j) => j !== i)
  }
</script>

<div class="grid">
  {#each photos as photo (photo.id)}
    <figure class:main={photo.isMain}>
      <img src={photo.url} alt="" />
      <div class="actions">
        <button type="button" class="pill" aria-label="Définir comme photo principale" aria-pressed={photo.isMain} onclick={() => makeMain(photo)}>
          <Icon name="star" size={18} filled={photo.isMain} />
        </button>
        <button type="button" class="pill" aria-label="Supprimer la photo" onclick={() => remove(photo)}>
          <Icon name="trash" size={18} />
        </button>
      </div>
    </figure>
  {/each}
  {#each pending as p, i (p.url)}
    <figure class:main={i === 0}>
      <img src={p.url} alt="" />
      <div class="actions">
        <button type="button" class="pill" aria-label="Définir comme photo principale" aria-pressed={i === 0} onclick={() => makePendingMain(i)}>
          <Icon name="star" size={18} filled={i === 0} />
        </button>
        <button type="button" class="pill" aria-label="Retirer la photo" onclick={() => removePending(i)}>
          <Icon name="trash" size={18} />
        </button>
      </div>
    </figure>
  {/each}
  {#each { length: uploading } as _, i (i)}
    <div class="slot loading" aria-label="Envoi en cours"></div>
  {/each}
  <button type="button" class="slot add" onclick={() => input.click()}>
    <Icon name="camera" size={26} />
    <span>Ajouter</span>
  </button>
</div>
<input bind:this={input} type="file" accept="image/*" multiple hidden onchange={pick} />

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }

  figure,
  .slot {
    position: relative;
    margin: 0;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
  }

  figure.main {
    outline: 3px solid var(--accent);
    outline-offset: -3px;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .actions {
    position: absolute;
    inset: auto 4px 4px 4px;
    display: flex;
    justify-content: space-between;
  }

  .pill {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 999px;
    background: rgb(0 0 0 / 50%);
    color: #fff;
    cursor: pointer;
  }

  .pill[aria-pressed='true'] {
    color: #ffd54a;
  }

  .slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 2px dashed var(--border);
    background: transparent;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .loading {
    border-style: solid;
    background: linear-gradient(90deg, var(--surface-2), var(--surface), var(--surface-2));
    background-size: 200% 100%;
    animation: shimmer 1s linear infinite;
  }

  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }
</style>
