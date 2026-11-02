/** Checks every minute whether today's session reminder is due. Returns a stop function. */
export function startScheduler(reminder: { runIfDue(): Promise<{ notified: number }> }, intervalMs = 60_000): () => void {
  let running = false
  const tick = async () => {
    if (running) return // a slow run must not overlap with the next one
    running = true
    try {
      const { notified } = await reminder.runIfDue()
      if (notified > 0) console.log(`Rappel de session envoyé à ${notified} appareil(s)`)
    } catch (err) {
      console.error('Échec du rappel de session', err)
    } finally {
      running = false
    }
  }
  void tick()
  const timer = setInterval(tick, intervalMs)
  return () => clearInterval(timer)
}
