"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationTone, Toast, ToastInput } from "@/types";

/**
 * Toasts: kort bericht rechtsonder, verdwijnt vanzelf.
 *
 * Drie regels die de vorm hiervan bepalen:
 *
 * 1. **Een toast is nooit de enige plek waar iets staat.** Hij is er drie
 *    seconden en overleeft geen paginawissel. Wat bewaard moet blijven, is een
 *    `Notification` (zie `src/lib/notifications/`); dit is het beeld erbij.
 * 2. **Fouten blijven staan.** `durationMs: 0` voor `danger`: wie iets moet
 *    lezen, mag niet moeten opschieten. De rest gaat vanzelf weg.
 * 3. **De klok staat stil zolang je kijkt.** Muis erover of focus erin pauzeert
 *    het aftellen — anders verdwijnt de melding net terwijl iemand hem leest,
 *    of net voor hij de knop erin kan raken.
 *
 * De regio zelf is `aria-live="polite"`, met `role="alert"` op de foutmeldingen:
 * dezelfde afspraak als in `Alert`, zodat een schermlezer niet onderbroken wordt
 * voor goed nieuws maar wel voor slecht.
 */

const toastTones: Record<NotificationTone, string> = {
  info: "border-info/25 bg-info-soft text-info",
  success: "border-success/25 bg-success-soft text-success",
  warning: "border-warning/25 bg-warning-soft text-warning",
  danger: "border-danger/25 bg-danger-soft text-danger",
};

const toastIcons: Record<NotificationTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

/** Standaardduur per zwaarte. `0` betekent: tot de gebruiker hem wegklikt. */
const DEFAULT_DURATION_MS: Record<NotificationTone, number> = {
  info: 5_000,
  success: 5_000,
  warning: 8_000,
  danger: 0,
};

/**
 * Hoogstens zoveel tegelijk. Bij een export naar vijf platformen komen er vijf
 * meldingen kort na elkaar; een stapel die het halve scherm vult, is geen
 * melding meer maar een obstakel. De oudste valt weg — die stond er al het
 * langst en staat sowieso in de bel.
 */
const MAX_VISIBLE = 4;

export type ToastContextValue = {
  /** Geeft het id terug, zodat een aanroeper hem zelf kan sluiten. */
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Buiten een `ToastProvider` gooit dit bewust. Een toast die stil verdwijnt in
 * een component die er wél op rekent, is een bug die je pas maanden later ziet.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast() heeft een <ToastProvider> boven zich nodig.");
  }

  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = input.id ?? `toast-${(counter.current += 1)}`;

    setToasts((current) => {
      // Hetzelfde id opnieuw is een vervanging, geen tweede blokje: zo kan een
      // aanroeper een lopende melding bijwerken ("Uploaden…" → "Klaar").
      const rest = current.filter((item) => item.id !== id);
      const next: Toast = {
        id,
        tone: input.tone,
        title: input.title,
        description: input.description,
        action: input.action,
        durationMs: input.durationMs ?? DEFAULT_DURATION_MS[input.tone],
      };

      return [...rest, next].slice(-MAX_VISIBLE);
    });

    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastRegion({
  toasts,
  onDismiss,
}: {
  toasts: readonly Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4",
        "sm:inset-x-auto sm:right-0 sm:items-end sm:p-6",
      )}
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} toast={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const Icon = toastIcons[toast.tone];

  useEffect(() => {
    if (toast.durationMs === 0 || paused) return;

    const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs);

    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, paused, onDismiss]);

  return (
    <div
      role={toast.tone === "danger" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-3.5 py-3",
        "text-sm shadow-elevated",
        toastTones[toast.tone],
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />

      <div className="min-w-0 flex-1 leading-snug">
        <p className="font-semibold">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-fg-muted">{toast.description}</p>
        ) : null}
        {toast.action ? (
          <Link
            href={toast.action.href}
            onClick={() => onDismiss(toast.id)}
            className="mt-1.5 inline-block font-medium underline underline-offset-2"
          >
            {toast.action.label}
          </Link>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Melding sluiten"
        className="-mr-1 -mt-1 rounded-md p-1 text-fg-subtle transition-colors hover:bg-black/5 dark:hover:bg-white/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
