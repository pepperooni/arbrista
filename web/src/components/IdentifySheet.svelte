<script lang="ts">
  import type { IdentifyCandidateDto } from '../../../src/shared/api-types.ts'
  import { api, errorMessage } from '../lib/api.ts'
  import Sheet from './Sheet.svelte'

  let {
    photo,
    onchoose,
    onclose,
  }: {
    photo: Blob | null
    onchoose: (candidate: IdentifyCandidateDto, keepPhoto: boolean) => void
    onclose: () => void
  } = $props()

  let status = $state<'loading' | 'done' | 'error'>('loading')
  let candidates = $state<IdentifyCandidateDto[]>([])
  let error = $state('')
  let preview = $state('')
  let keepPhoto = $state(true)
  let libraryNames = $state<Record<string, string>>({})

  $effect(() => {
    const p = photo
    if (!p) return
    const url = URL.createObjectURL(p)
    preview = url
    status = 'loading'
    error = ''
    api
      .upload<IdentifyCandidateDto[]>('/identify', p, 'photo.jpg', 'image')
      .then(async (found) => {
        if (photo !== p) return
        candidates = found
        status = 'done'
        if (found.some((c) => c.catalogId)) {
          const { PLANT_CATALOG } = await import('../../../src/shared/plant-catalog.ts')
          libraryNames = Object.fromEntries(PLANT_CATALOG.map((e) => [e.id, e.name]))
        }
      })
      .catch((e) => {
        if (photo !== p) return
        error = errorMessage(e)
        status = 'error'
      })
    return () => URL.revokeObjectURL(url)
  })

  const label = (c: IdentifyCandidateDto) => (c.catalogId && libraryNames[c.catalogId]) || c.commonName || c.scientificName
  const percent = (score: number) => Math.round(score * 100)
</script>

<Sheet open={photo !== null} {onclose} title="Identification de la plante">
  {#if preview}<img class="preview" src={preview} alt="Plante à identifier" />{/if}

  {#if status === 'loading'}
    <p class="muted center" aria-busy="true">Analyse de la photo…</p>
  {:else if status === 'error'}
    <p class="error" role="alert">{error}</p>
  {:else if candidates.length === 0}
    <p class="muted">Aucune plante reconnue. Essayez une photo plus nette, centrée sur une feuille ou une fleur.</p>
  {:else}
    <p class="muted small">Touchez la bonne plante :</p>
    <ul class="candidates">
      {#each candidates as c (c.scientificName)}
        <li>
          <button class="candidate" onclick={() => onchoose(c, keepPhoto)}>
            <span class="names">
              <strong>{label(c)}</strong>
              <span class="sci">{c.scientificName}</span>
              {#if c.matchedBy === 'species'}
                <span class="badge badge-water">Dans la bibliothèque</span>
              {:else if c.matchedBy === 'genus'}
                <span class="badge">Espèce voisine dans la bibliothèque</span>
              {/if}
            </span>
            <span class="score" class:low={c.score < 0.2}>
              {percent(c.score)} %
              <span class="bar"><span style:width="{percent(c.score)}%"></span></span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
    <label class="keep">
      <input type="checkbox" bind:checked={keepPhoto} />
      <span>Ajouter cette photo à la fiche de la plante</span>
    </label>
  {/if}
  <p class="credit">Identification par <a href="https://plantnet.org" target="_blank" rel="noopener">Pl@ntNet</a>.</p>
  <button class="btn btn-ghost btn-block" onclick={onclose}>Fermer</button>
</Sheet>

<style>
  .preview {
    width: 100%;
    max-height: 200px;
    object-fit: cover;
    border-radius: 12px;
  }

  .center {
    text-align: center;
  }

  .small {
    font-size: 0.9rem;
  }

  .error {
    color: var(--danger);
  }

  .candidates {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .candidate {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    text-align: left;
    cursor: pointer;
  }

  .candidate:active {
    background: var(--surface-2);
  }

  .names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .sci {
    font-size: 0.85rem;
    font-style: italic;
    color: var(--text-muted);
  }

  .score {
    flex: none;
    width: 64px;
    font-weight: 700;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .score.low {
    color: var(--text-muted);
  }

  .bar {
    display: block;
    height: 4px;
    margin-top: 4px;
    border-radius: 2px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }

  .keep {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--tap);
    font-size: 0.95rem;
  }

  .keep input {
    width: 22px;
    height: 22px;
    accent-color: var(--accent);
  }

  .credit {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .credit a {
    text-decoration: underline;
  }
</style>
