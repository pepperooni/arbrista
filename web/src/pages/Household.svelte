<script lang="ts">
  import type { HouseholdDto, OccupantDto, RoomDto } from '../../../src/shared/api-types.ts'
  import Icon from '../components/Icon.svelte'
  import DeviceCodeSheet from '../components/DeviceCodeSheet.svelte'
  import InviteSheet from '../components/InviteSheet.svelte'
  import Sheet from '../components/Sheet.svelte'
  import { api, errorMessage } from '../lib/api.ts'
  import { disablePush, enablePush, isSubscribed, pushSupport } from '../lib/push.ts'
  import { session } from '../lib/session.svelte.ts'
  import { showToast } from '../lib/toast.svelte.ts'

  let household = $state<HouseholdDto | null>(null)
  let rooms = $state<RoomDto[]>([])
  let occupants = $state<OccupantDto[]>([])
  let newRoom = $state('')
  let editing = $state<{ id: string; name: string } | null>(null)
  let roomToDelete = $state<RoomDto | null>(null)
  let occupantToRemove = $state<OccupantDto | null>(null)
  let inviteOpen = $state(false)
  let deviceOpen = $state(false)
  let support = pushSupport()
  let subscribed = $state(false)
  let pushBusy = $state(false)

  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

  async function load() {
    try {
      ;[household, rooms, occupants] = await Promise.all([
        api.get<HouseholdDto>('/household'),
        api.get<RoomDto[]>('/rooms'),
        api.get<OccupantDto[]>('/occupants'),
      ])
    } catch (e) {
      showToast(errorMessage(e))
    }
  }
  load()
  if (support === 'supported') isSubscribed().then((s) => (subscribed = s)).catch(() => {})

  async function run(action: () => Promise<unknown>, success?: string) {
    try {
      await action()
      if (success) showToast(success)
      await load()
    } catch (e) {
      showToast(errorMessage(e))
    }
  }

  function addRoom(e: SubmitEvent) {
    e.preventDefault()
    const name = newRoom.trim()
    if (!name) return
    run(() => api.post('/rooms', { name })).then(() => (newRoom = ''))
  }

  function saveRename(e: SubmitEvent) {
    e.preventDefault()
    if (!editing) return
    const { id, name } = editing
    editing = null
    run(() => api.patch(`/rooms/${id}`, { name }))
  }

  function deleteRoom() {
    const room = roomToDelete
    roomToDelete = null
    if (room) run(() => api.del(`/rooms/${room.id}`), `Pièce « ${room.name} » supprimée`)
  }

  function removeOccupant() {
    const o = occupantToRemove
    occupantToRemove = null
    if (o) run(() => api.del(`/occupants/${o.id}`), `${o.name} a été retiré du logement`)
  }

  function updateSetting(patch: Partial<HouseholdDto>) {
    run(() => api.patch('/household', patch), 'Réglage enregistré')
  }

  async function togglePush(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    pushBusy = true
    try {
      if (subscribed) await disablePush()
      else await enablePush()
      subscribed = !subscribed
      showToast(subscribed ? 'Rappels activés sur cet appareil' : 'Rappels désactivés sur cet appareil')
    } catch (e) {
      showToast(errorMessage(e))
    } finally {
      pushBusy = false
      input.checked = subscribed // the native checkbox flips on click even when enabling fails
    }
  }

  const monthOf = (md: string) => Number(md.slice(0, 2))
  const dayOf = (md: string) => Number(md.slice(3, 5))
  const toMonthDay = (month: number, day: number) => `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
</script>

<main class="page">
  <header class="page-header">
    <h1>{household?.name ?? 'Logement'}</h1>
  </header>

  <!-- Rooms -->
  <h2 class="section-title">Pièces</h2>
  <section class="card list">
    {#each rooms as room (room.id)}
      <div class="row">
        {#if editing?.id === room.id}
          <form class="rename" onsubmit={saveRename}>
            <!-- svelte-ignore a11y_autofocus -->
            <input class="input" bind:value={editing.name} maxlength="40" aria-label="Nom de la pièce" autofocus />
            <button class="icon-btn" aria-label="Valider"><Icon name="check" /></button>
          </form>
        {:else}
          <Icon name="door" size={20} />
          <span class="grow">{room.name}</span>
          <button class="icon-btn" aria-label="Renommer {room.name}" onclick={() => (editing = { id: room.id, name: room.name })}>
            <Icon name="pencil" size={18} />
          </button>
          <button class="icon-btn" aria-label="Supprimer {room.name}" onclick={() => (roomToDelete = room)}>
            <Icon name="trash" size={18} />
          </button>
        {/if}
      </div>
    {/each}
    <form class="row add" onsubmit={addRoom}>
      <input class="input" bind:value={newRoom} placeholder="Nouvelle pièce (Salon, Cuisine…)" maxlength="40" aria-label="Nouvelle pièce" />
      <button class="icon-btn add-btn" aria-label="Ajouter la pièce" disabled={!newRoom.trim()}><Icon name="plus" /></button>
    </form>
  </section>

  <!-- Occupants -->
  <h2 class="section-title">Occupants</h2>
  <section class="card list">
    {#each occupants as o (o.id)}
      <div class="row">
        <span class="avatar" aria-hidden="true">{o.name.slice(0, 1).toUpperCase()}</span>
        <span class="grow"><span>{o.name}{#if o.id === session.occupant?.id}<span class="muted">{' · vous'}</span>{/if}</span></span>
        {#if o.id !== session.occupant?.id}
          <button class="icon-btn" aria-label="Retirer {o.name}" onclick={() => (occupantToRemove = o)}><Icon name="x" size={18} /></button>
        {/if}
      </div>
    {/each}
    <div class="row">
      <button class="btn btn-primary btn-block" onclick={() => (inviteOpen = true)} disabled={!household}>
        <Icon name="users" size={20} /> Inviter un occupant
      </button>
    </div>
    <div class="row">
      <button class="btn btn-block" onclick={() => (deviceOpen = true)}>Connecter un autre appareil</button>
    </div>
  </section>

  <!-- Notifications -->
  <h2 class="section-title">Rappels</h2>
  <section class="card block">
    {#if support === 'supported'}
      <label class="switch-row">
        <span class="grow">
          <strong>Notifications sur cet appareil</strong>
          <span class="muted small">Un seul rappel par session, à {household?.sessionTime ?? '18:00'}.</span>
        </span>
        <input type="checkbox" class="switch" checked={subscribed} disabled={pushBusy} onchange={togglePush} />
      </label>
    {:else if support === 'needs-install'}
      <p><strong>Installez Arbrista pour recevoir les rappels.</strong></p>
      <ol class="muted small steps">
        <li>Ajoutez Arbrista à l'écran d'accueil (Partager → Sur l'écran d'accueil).</li>
        <li>Ouvrez l'application depuis son icône : elle ne partage pas la connexion de Safari.</li>
        <li>Saisissez-y le code de connexion ci-dessous pour retrouver votre compte.</li>
      </ol>
      <button class="btn btn-primary btn-block install-code" onclick={() => (deviceOpen = true)}>Afficher un code de connexion</button>
    {:else}
      <p class="muted">Ce navigateur ne prend pas en charge les notifications. La session du jour reste visible dans l'onglet Aujourd'hui.</p>
    {/if}
  </section>

  <!-- Settings -->
  {#if household}
    <h2 class="section-title">Réglages</h2>
    <section class="card block stack">
      <label class="field">
        <span>Nom du logement</span>
        <input class="input" value={household.name} maxlength="60" onchange={(e) => updateSetting({ name: e.currentTarget.value })} />
      </label>
      <label class="field">
        <span>Heure de la session d'arrosage</span>
        <input class="input" type="time" value={household.sessionTime} onchange={(e) => e.currentTarget.value && updateSetting({ sessionTime: e.currentTarget.value })} />
      </label>
      {#each [{ key: 'summerStart', label: "Début de l'été" }, { key: 'winterStart', label: "Début de l'hiver" }] as const as s (s.key)}
        <div class="field">
          <span>{s.label}</span>
          <div class="date-pair">
            <select
              class="input"
              aria-label="{s.label} : jour"
              value={dayOf(household[s.key])}
              onchange={(e) => updateSetting({ [s.key]: toMonthDay(monthOf(household![s.key]), Number(e.currentTarget.value)) })}
            >
              {#each { length: 31 } as _, i (i)}<option value={i + 1}>{i + 1}</option>{/each}
            </select>
            <select
              class="input"
              aria-label="{s.label} : mois"
              value={monthOf(household[s.key])}
              onchange={(e) => updateSetting({ [s.key]: toMonthDay(Number(e.currentTarget.value), Math.min(dayOf(household![s.key]), 28)) })}
            >
              {#each MONTHS as m, i (m)}<option value={i + 1}>{m}</option>{/each}
            </select>
          </div>
        </div>
      {/each}
      <p class="muted small">Le rythme d'hiver d'une plante s'applique du début de l'hiver jusqu'au début de l'été.</p>
    </section>

    <InviteSheet bind:open={inviteOpen} bind:inviteCode={household.inviteCode} />
  {/if}
</main>

<DeviceCodeSheet bind:open={deviceOpen} />

<Sheet open={roomToDelete !== null} onclose={() => (roomToDelete = null)} title="Supprimer « {roomToDelete?.name} » ?">
  <p class="muted">Les plantes de cette pièce seront rattachées au logement.</p>
  <button class="btn btn-block danger" onclick={deleteRoom}>Supprimer</button>
  <button class="btn btn-ghost btn-block" onclick={() => (roomToDelete = null)}>Annuler</button>
</Sheet>

<Sheet open={occupantToRemove !== null} onclose={() => (occupantToRemove = null)} title="Retirer {occupantToRemove?.name} ?">
  <p class="muted">Cette personne n'aura plus accès au logement. Ses arrosages restent dans l'historique.</p>
  <button class="btn btn-block danger" onclick={removeOccupant}>Retirer</button>
  <button class="btn btn-ghost btn-block" onclick={() => (occupantToRemove = null)}>Annuler</button>
</Sheet>

<style>
  .list {
    overflow: hidden;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 56px;
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--border);
  }

  .row:last-child {
    border-bottom: 0;
  }

  .grow {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .rename,
  .add {
    display: flex;
    gap: var(--space-2);
    flex: 1;
  }

  .add-btn {
    background: var(--accent);
    color: var(--on-accent);
  }

  .add-btn:disabled {
    opacity: 0.4;
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-weight: 700;
    flex: none;
  }

  .block {
    padding: var(--space-4);
  }

  .small {
    font-size: 0.88rem;
  }

  .switch-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    cursor: pointer;
  }

  .switch {
    appearance: none;
    position: relative;
    width: 52px;
    height: 32px;
    border-radius: 999px;
    background: var(--border);
    cursor: pointer;
    flex: none;
    transition: background 0.2s;
  }

  .switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
    transition: transform 0.2s;
  }

  .switch:checked {
    background: var(--accent);
  }

  .switch:checked::after {
    transform: translateX(20px);
  }

  .date-pair {
    display: grid;
    grid-template-columns: 88px 1fr;
    gap: var(--space-2);
  }

  .steps {
    margin: var(--space-2) 0 var(--space-3);
    padding-left: 1.2em;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .danger {
    background: var(--danger);
    color: #fff;
  }
</style>
