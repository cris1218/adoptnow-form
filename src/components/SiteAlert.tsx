"use client";

import { useEffect, useRef } from "react";

type SiteAlertTone = "success" | "error" | "info";

export type SiteAlertState = {
  title: string;
  message: string;
  tone?: SiteAlertTone;
} | null;

const AUTO_CLOSE_MS = 5000;

const toneStyles: Record<
  SiteAlertTone,
  { shell: string; title: string; iconBg: string }
> = {
  success: {
    shell: "border-emerald-200 bg-white",
    title: "text-emerald-800",
    iconBg: "bg-emerald-100 text-emerald-800",
  },
  error: {
    shell: "border-rose-200 bg-white",
    title: "text-rose-800",
    iconBg: "bg-rose-100 text-rose-800",
  },
  info: {
    shell: "border-stone-200 bg-white",
    title: "text-stone-900",
    iconBg: "bg-brand-light/20 text-brand-950",
  },
};

export function SiteAlert({
  alert,
  onClose,
}: {
  alert: SiteAlertState;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => onCloseRef.current(), AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [alert]);

  if (!alert) return null;

  const tone = alert.tone ?? "info";
  const styles = toneStyles[tone];

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-end p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5"
      aria-live="polite"
    >
      <div
        role="alert"
        className={`site-alert-enter pointer-events-auto w-full max-w-sm rounded-2xl border p-4 shadow-[0_18px_40px_rgba(14,90,88,0.18)] ${styles.shell}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${styles.iconBg}`}
            aria-hidden="true"
          >
            {tone === "success" ? "✓" : tone === "error" ? "!" : "i"}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold tracking-tight ${styles.title}`}>
              {alert.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">
              {alert.message}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            className="cursor-pointer rounded-lg px-1.5 py-0.5 text-lg leading-none text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
