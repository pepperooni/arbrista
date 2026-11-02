<script lang="ts">
  import type { Weekday } from '../../../src/domain/calendar.ts'
  import type { RhythmInput } from '../../../src/shared/api-types.ts'
  import { WEEKDAY_LETTER, WEEKDAY_LONG, formatRhythm } from '../lib/format.ts'

  let { value = $bindable(), label }: { value: RhythmInput; label: string } = $props()

  // Remember both shapes so switching mode back and forth keeps what was typed.
  let weekly = $state(value.kind === 'weekly' ? { days: [...value.days], everyWeeks: value.everyWeeks } : { days: [0, 3], everyWeeks: 1 })
  let everyDays = $state(value.kind === 'interval' ? value.everyDays : 7)
  let kind = $state(value.kind)

  $effect(() => {
    value =
      kind === 'weekly'
        ? { kind: 'weekly', days: [...weekly.days].sort((a, b) => a - b) as Weekday[], everyWeeks: weekly.everyWeeks }
        : { kind: 'interval', everyDays }
  })

  function toggleDay(d: number) {
    weekly.days = weekly.days.includes(d) ? weekly.days.filter((x) => x !== d) : [...weekly.days, d]
  }

  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n) || min))
</script>

<fieldset class="rhythm">
  <legend>{label}</legend>
  <div class="segmented" role="radiogroup" aria-label="Type de rythme">
    <button type="button" role="radio" aria-checked={kind === 'weekly'} onclick={() => (kind = 'weekly')}>Jours fixes</button>
    <button type="button" role="radio" aria-checked={kind === 'interval'} onclick={() => (kind = 'interval')}>Tous les N jours</button>
  </div>

  {#if kind === 'weekly'}
    <div class="days" role="group" aria-label="Jours d'arrosage">
      {#each WEEKDAY_LETTER as letter, d (d)}
        <button type="button" class="day" aria-pressed={weekly.days.includes(d)} aria-label={WEEKDAY_LONG[d]} onclick={() => toggleDay(d)}>
          {letter}
        </button>
      {/each}
    </div>
    <div class="stepper">
      <span>Toutes les</span>
      <button type="button" class="icon-btn step" aria-label="Moins" onclick={() => (weekly.everyWeeks = clamp(weekly.everyWeeks - 1, 1, 52))}>−</button>
      <input class="input num" type="number" min="1" max="52" inputmode="numeric" bind:value={weekly.everyWeeks} onchange={() => (weekly.everyWeeks = clamp(weekly.everyWeeks, 1, 52))} aria-label="Nombre de semaines" />
      <button type="button" class="icon-btn step" aria-label="Plus" onclick={() => (weekly.everyWeeks = clamp(weekly.everyWeeks + 1, 1, 52))}>+</button>
      <span>{weekly.everyWeeks === 1 ? 'semaine' : 'semaines'}</span>
    </div>
  {:else}
    <div class="stepper">
      <span>Tous les</span>
      <button type="button" class="icon-btn step" aria-label="Moins" onclick={() => (everyDays = clamp(everyDays - 1, 1, 365))}>−</button>
      <input class="input num" type="number" min="1" max="365" inputmode="numeric" bind:value={everyDays} onchange={() => (everyDays = clamp(everyDays, 1, 365))} aria-label="Nombre de jours" />
      <button type="button" class="icon-btn step" aria-label="Plus" onclick={() => (everyDays = clamp(everyDays + 1, 1, 365))}>+</button>
      <span>jours après le dernier arrosage</span>
    </div>
  {/if}

  <p class="summary">{formatRhythm(value)}</p>
</fieldset>

<style>
  .rhythm {
    border: 0;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  legend {
    font-weight: 700;
    margin-bottom: var(--space-2);
  }

  .segmented {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 4px;
    border-radius: 999px;
    background: var(--surface-2);
  }

  .segmented button {
    min-height: 40px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    font-weight: 600;
    cursor: pointer;
  }

  .segmented button[aria-checked='true'] {
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
  }

  .day {
    aspect-ratio: 1;
    min-height: var(--tap);
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    font-weight: 700;
    cursor: pointer;
  }

  .day[aria-pressed='true'] {
    background: var(--water);
    border-color: var(--water);
    color: #fff;
  }

  .stepper {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .step {
    background: var(--surface-2);
    font-size: 1.3rem;
    font-weight: 700;
  }

  .num {
    width: 64px;
    text-align: center;
  }

  .summary {
    font-size: 0.9rem;
    color: var(--water);
    font-weight: 600;
  }
</style>
