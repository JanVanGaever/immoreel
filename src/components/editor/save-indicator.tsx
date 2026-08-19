"use client";

import { AlertTriangle, Check, CloudUpload, Pencil } from "lucide-react";
import type { AutosaveController } from "@/components/editor/use-autosave";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Wat er met het werk van de gebruiker gebeurt, in één regel.
 *
 * Autosave die niets laat zien is autosave die je niet vertrouwt. Daarom
 * hebben alle vier de toestanden een eigen tekst, en is de enige toestand met
 * een knop degene waarin er iets te doen valt: opnieuw proberen.
 */
export function SaveIndicator({ save, className }: { save: AutosaveController; className?: string }) {
  if (save.status === "mislukt") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="flex items-center gap-1.5 text-xs font-medium text-danger">
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">{save.error ?? "Niet bewaard"}</span>
        </span>
        <Button variant="secondary" size="sm" onClick={save.saveNow}>
          Opnieuw
        </Button>
      </div>
    );
  }

  if (save.status === "bezig") {
    return (
      <span className={cn("flex items-center gap-1.5 text-xs text-fg-muted", className)}>
        <Spinner label="Bewaren" className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">Bewaren…</span>
      </span>
    );
  }

  if (save.status === "wijzigingen") {
    return (
      <span className={cn("flex items-center gap-1.5 text-xs text-fg-muted", className)}>
        <Pencil aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">Niet-bewaarde wijzigingen</span>
      </span>
    );
  }

  return (
    <span
      className={cn("flex items-center gap-1.5 text-xs text-fg-subtle", className)}
      title={save.savedAt ? `Laatst bewaard ${formatRelativeTime(save.savedAt)}` : "Alles bewaard"}
    >
      {save.savedAt ? (
        <Check aria-hidden="true" className="size-3.5 shrink-0 text-success" />
      ) : (
        <CloudUpload aria-hidden="true" className="size-3.5 shrink-0" />
      )}
      {/* Op een smal scherm blijft alleen het icoon over; de tekst staat in de tooltip. */}
      <span className="hidden sm:inline">
        {save.savedAt ? `Bewaard ${formatRelativeTime(save.savedAt)}` : "Alles bewaard"}
      </span>
    </span>
  );
}
