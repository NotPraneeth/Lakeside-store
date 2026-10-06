"use client";

import { useEffect, useState } from "react";
import type { ToastKind } from "@/lib/toast";

type Toast = { id: number; message: string; kind: ToastKind };

const STYLES: Record<ToastKind, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  error: "border-red-500/30 bg-red-500/10 text-red-200",
  info: "border-indigo-500/30 bg-indigo-500/10 text-indigo-200",
};

const DOTS: Record<ToastKind, string> = {
  success: "bg-emerald-400",
  error: "bg-red-400",
  info: "bg-indigo-400",
};

let nextId = 1;

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string; kind: ToastKind }>).detail;
      if (!detail?.message) return;
      const id = nextId++;
      const kind = detail.kind ?? "success";
      setToasts((t) => [...t.slice(-2), { id, message: detail.message, kind }]);
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 3200);
    };
    window.addEventListener("app-toast", onToast);
    return () => window.removeEventListener("app-toast", onToast);
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 mx-auto flex w-full max-w-sm flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-toast-in pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-medium shadow-2xl shadow-black/50 backdrop-blur ${STYLES[t.kind]}`}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOTS[t.kind]}`} />
          <span className="line-clamp-2">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
