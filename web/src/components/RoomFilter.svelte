<script lang="ts">
  import type { RoomDto } from '../../../src/shared/api-types.ts'

  /** `null` = all plants, `''` = plants attached to the household only, otherwise a room id. */
  let { rooms, value = $bindable(null) }: { rooms: RoomDto[]; value?: string | null } = $props()

  const options = $derived([
    { id: null, label: 'Toutes' },
    ...rooms.map((r) => ({ id: r.id as string | null, label: r.name })),
    { id: '', label: 'Logement' },
  ])
</script>

<div class="chips" role="group" aria-label="Filtrer par pièce">
  {#each options as o (o.id ?? 'all')}
    <button class="chip" aria-pressed={value === o.id} onclick={() => (value = o.id)}>{o.label}</button>
  {/each}
</div>
