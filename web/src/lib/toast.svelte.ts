export type ToastAction = { label: string; run: () => void }
export type ToastState = { id: number; message: string; action?: ToastAction } | null

export const toast = $state<{ current: ToastState }>({ current: null })

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

export function showToast(message: string, action?: ToastAction, ms = 5000): void {
  clearTimeout(timer)
  const id = ++seq
  toast.current = { id, message, action }
  timer = setTimeout(() => {
    if (toast.current?.id === id) toast.current = null
  }, ms)
}

export function dismissToast(): void {
  clearTimeout(timer)
  toast.current = null
}
