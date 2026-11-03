<script lang="ts">
  import type { SessionItemDto } from '../../../src/shared/api-types.ts'
  import { formatTime } from '../lib/format.ts'
  import { navigate } from '../lib/router.svelte.ts'
  import Icon from './Icon.svelte'

  let { item, onWater }: { item: SessionItemDto; onWater: (item: SessionItemDto) => void } = $props()

  const SWIPE_THRESHOLD = 80
  let startX = 0
  let startY = 0
  let dx = $state(0)
  let tracking = false
  let moved = false

  function down(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    tracking = true
    moved = false
    startX = e.clientX
    startY = e.clientY
  }

  function move(e: PointerEvent) {
    if (!tracking) return
    const x = e.clientX - startX
    const y = e.clientY - startY
    if (Math.abs(x) > 8 || Math.abs(y) > 8) moved = true
    if (Math.abs(y) > Math.abs(x)) return
    dx = item.done ? 0 : Math.max(0, Math.min(x, 140))
  }

  function up() {
    if (!tracking) return
    tracking = false
    if (dx >= SWIPE_THRESHOLD && !item.done) onWater(item)
    else if (!moved) navigate(`/plants/${item.plantId}`)
    dx = 0
  }
</script>

<li class="wrap">
  <div class="swipe-hint" style:opacity={Math.min(dx / SWIPE_THRESHOLD, 1)}>
    <Icon name="droplet" />
  </div>
  <div
    class="card row"
    class:done={item.done}
    style:transform="translateX({dx}px)"
    style:transition={dx === 0 ? 'transform 0.2s ease' : 'none'}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={() => ((tracking = false), (dx = 0))}
    role="link"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' && navigate(`/plants/${item.plantId}`)}
  >
    {#if item.mainPhotoUrl}
      <img class="photo" src={item.mainPhotoUrl} alt="" loading="lazy" />
    {:else}
      <div class="photo thumb-placeholder"><Icon name="sprout" size={26} /></div>
    {/if}

    <div class="info">
      <strong>{item.name}</strong>
      {#if item.done}
        <span class="muted small">Arrosée par {item.done.occupantName} · {formatTime(item.done.at)}</span>
      {:else if item.daysOverdue > 0}
        <span class="badge badge-warn">en retard de {item.daysOverdue} j</span>
      {:else if item.daysEarly > 0}
        <span class="badge">en avance de {item.daysEarly} j</span>
      {:else}
        <span class="muted small">à arroser aujourd'hui</span>
      {/if}
    </div>

    {#if item.done}
      <span class="check" aria-label="Arrosée"><Icon name="check" /></span>
    {:else}
      <button class="water" aria-label="Marquer {item.name} comme arrosée" onclick={() => onWater(item)}>
        <Icon name="droplet" size={24} />
      </button>
    {/if}
  </div>
</li>

<style>
  .wrap {
    position: relative;
    list-style: none;
  }

  .swipe-hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    padding-left: var(--space-5);
    border-radius: var(--radius);
    background: var(--water-soft);
    color: var(--water);
  }

  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    touch-action: pan-y;
    user-select: none;
    cursor: pointer;
  }

  .row.done {
    opacity: 0.62;
  }

  .photo {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    object-fit: cover;
    flex: none;
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .info strong {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .small {
    font-size: 0.85rem;
  }

  .water {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: 999px;
    background: var(--water);
    color: #fff;
    cursor: pointer;
    flex: none;
    transition: transform 0.08s ease;
  }

  .water:active {
    transform: scale(0.92);
  }

  .check {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent);
    flex: none;
  }
</style>
