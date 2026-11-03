<script lang="ts">
  import type { CatalogPlant } from '../../../src/shared/plant-catalog.ts'
  import Icon from './Icon.svelte'

  let { onpick }: { onpick: (p: CatalogPlant) => void } = $props()

  let query = $state('')
  let results = $state<CatalogPlant[]>([])
  // The library is only downloaded when the user starts searching.
  let search: ((q: string) => CatalogPlant[]) | null = null

  async function update() {
    if (!search) search = (await import('../../../src/shared/catalog.ts')).searchCatalog
    results = search(query)
  }

  function pick(p: CatalogPlant) {
    query = ''
    results = []
    onpick(p)
  }
</script>

<div class="catalog">
  <label class="search">
    <Icon name="search" size={20} />
    <input
      type="search"
      bind:value={query}
      oninput={update}
      placeholder="Rechercher dans la bibliothèque"
      aria-label="Rechercher une plante dans la bibliothèque"
      autocomplete="off"
    />
  </label>
  {#if query.trim() && results.length === 0}
    <p class="muted none">Aucune plante trouvée. Vous pouvez remplir la fiche vous-même.</p>
  {:else if results.length > 0}
    <ul class="results card" role="listbox" aria-label="Plantes de la bibliothèque">
      {#each results as p (p.id)}
        <li>
          <button type="button" role="option" aria-selected="false" onclick={() => pick(p)}>
            <strong>{p.name}</strong>
            <span class="sci">{p.scientificName}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--tap);
    padding: 0 var(--space-3);
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

  .results {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: var(--space-1) 0;
    overflow: hidden;
  }

  .results button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    min-height: var(--tap);
    padding: var(--space-2) var(--space-4);
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .results button:active {
    background: var(--surface-2);
  }

  .sci {
    font-size: 0.85rem;
    font-style: italic;
    color: var(--text-muted);
  }

  .none {
    margin: var(--space-2) var(--space-3) 0;
    font-size: 0.9rem;
  }
</style>
