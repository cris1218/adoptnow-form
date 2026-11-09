"use client";

type SiteAlertTone = "success" | "error" | "info";

export type SiteAlertState = {
  title: string;
  message: string;
  tone?: SiteAlertTone;
} | null;

const toneStyles: Record<
  SiteAlertTone,
  { badge: string; button: string; iconBg: string }
> = {
  success: {
    badge: "text-emerald-800",
    button: "bg-brand-dark text-white hover:bg-brand-950",
    iconBg: "bg-emerald-100 text-emerald-800",
  },
  error: {
    badge: "text-rose-800",
    button: "bg-rose-700 text-white hover:bg-rose-800",
    iconBg: "bg-rose-100 text-rose-800",
  },
  info: {
    badge: "text-stone-800",
    button: "bg-brand-dark text-white hover:bg-brand-950",
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
  if (!alert) return null;

  const tone = alert.tone ?? "info";
  const styles = toneStyles[tone];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="site-alert-title"
      aria-describedby="site-alert-message"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl text-lg font-bold ${styles.iconBg}`}
          aria-hidden="true"
        >
          {tone === "success" ? "✓" : tone === "error" ? "!" : "i"}
        </div>
        <h2
          id="site-alert-title"
          className={`mt-3 text-xl font-bold tracking-tight ${styles.badge}`}
        >
          {alert.title}
        </h2>
        <p
          id="site-alert-message"
          className="mt-2 text-base leading-relaxed text-stone-600"
        >
          {alert.message}
        </p>
        <button
          type="button"
          className={`mt-5 flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl text-base font-semibold shadow-sm transition active:scale-[0.99] ${styles.button}`}
          onClick={onClose}
        >
          OK
        </button>
      </div>
    </div>
  );
}
