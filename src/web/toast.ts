// Toasts: short messages at the bottom of the screen ("Invoice saved.", or why a request failed). Any
// code can raise one (api.ts on failures, forms on save); <Toasts /> in the shell shows them.
// Same call shape as React Spectrum's ToastQueue, which this replaced.
export type Toast = { id: number; tone: "positive" | "negative"; message: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function show(tone: Toast["tone"], message: string, { timeout }: { timeout?: number } = {}) {
  const id = nextId++;
  toasts = [...toasts, { id, tone, message }];
  emit();
  const close = () => dismiss(id);
  if (timeout) setTimeout(close, timeout);
  return close;
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const ToastQueue = {
  positive: (message: string, options?: { timeout?: number }) => show("positive", message, options),
  negative: (message: string, options?: { timeout?: number }) => show("negative", message, options),
};

/** For useSyncExternalStore. */
export const subscribe = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn));
export const currentToasts = () => toasts;
