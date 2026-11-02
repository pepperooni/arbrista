<script lang="ts">
  import QRCode from 'qrcode'
  import { api, errorMessage } from '../lib/api.ts'
  import { showToast } from '../lib/toast.svelte.ts'
  import Icon from './Icon.svelte'
  import Sheet from './Sheet.svelte'

  let { open = $bindable(false), inviteCode = $bindable() }: { open?: boolean; inviteCode: string } = $props()

  const url = $derived(`${location.origin}/join/${inviteCode}`)
  let qr = $state('')

  $effect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: '#17231b', light: '#ffffff' } })
      .then((data) => (qr = data))
      .catch(() => (qr = ''))
  })

  async function share() {
    const text = "Rejoins-moi sur Arrosoir pour suivre l'arrosage des plantes de la maison 🌿"
    try {
      if (navigator.share) await navigator.share({ title: 'Arrosoir', text, url })
      else {
        await navigator.clipboard.writeText(url)
        showToast('Lien copié')
      }
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') showToast('Partage impossible, copiez le lien ci-dessous')
    }
  }

  async function regenerate() {
    try {
      inviteCode = (await api.post<{ inviteCode: string }>('/household/invite')).inviteCode
      showToast("Nouveau lien créé, l'ancien ne fonctionne plus")
    } catch (e) {
      showToast(errorMessage(e))
    }
  }
</script>

<Sheet bind:open title="Inviter un occupant">
  <p class="muted">Faites scanner ce code, ou partagez le lien. La personne n'aura qu'à saisir son prénom.</p>
  {#if qr}<img class="qr" src={qr} alt="QR code du lien d'invitation" />{/if}
  <input class="input link" readonly value={url} aria-label="Lien d'invitation" onfocus={(e) => e.currentTarget.select()} />
  <button class="btn btn-primary btn-block" onclick={share}><Icon name="share" size={20} /> Partager le lien</button>
  <button class="btn btn-ghost btn-block" onclick={regenerate}>Régénérer le lien</button>
</Sheet>

<style>
  .qr {
    width: min(240px, 70vw);
    margin: 0 auto;
    border-radius: 12px;
    border: 1px solid var(--border);
  }

  .link {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
</style>
