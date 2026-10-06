export type ToastKind = "success" | "error" | "info";

export function toast(message: string, kind: ToastKind = "success"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("app-toast", { detail: { message, kind } }));
}
