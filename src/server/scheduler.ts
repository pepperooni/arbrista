/** Checks every minute whether today's session reminder is due. Returns a stop function. */
export function startScheduler(reminder: { runIfDue(): Promise<{ notified: number }> }, intervalMs = 60_000): () => void {
  const tick = async () => {
    try {
      const { notified } = await reminder.runIfDue()
      if (notified > 0) console.log(`Rappel de session envoyé à ${notified} appareil(s)`)
    } catch (err) {
      console.error('Échec du rappel de session', err)
    }
  }
  void tick()
  const timer = setInterval(tick, intervalMs)
  return () => clearInterval(timer)
}
