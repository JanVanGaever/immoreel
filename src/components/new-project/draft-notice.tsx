"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { FileClock } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import {
  clearStoredDraft,
  parseStoredDraft,
  readRawDraft,
  subscribeToStoredDraft,
} from "@/lib/new-project/draft-storage";

/** Op de server is er geen opslag; daar bestaat er dus ook geen concept. */
const serverSnapshot = () => null;

/**
 * Herinnering aan een niet-afgewerkt concept, voor boven de projectenlijst.
 * Het concept staat in de browser van de gebruiker (zie `draft-storage.ts`),
 * dus tijdens het serveren toont deze kaart niets.
 */
export function DraftNotice({ className }: { className?: string }) {
  const raw = useSyncExternalStore(subscribeToStoredDraft, readRawDraft, serverSnapshot);
  const stored = useMemo(() => parseStoredDraft(raw), [raw]);

  if (!stored) return null;

  return (
    <Card className={className}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
            <FileClock aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">
              {stored.draft.title.trim() || "Naamloos project"}
            </p>
            <p className="mt-0.5 text-xs text-fg-muted">
              Niet afgewerkt concept, bijgewerkt {formatRelativeTime(stored.draft.updatedAt)}.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearStoredDraft}>
            Verwijderen
          </Button>
          <Link href={ROUTES.newProject} className={buttonClasses("secondary", "sm")}>
            Verder werken
          </Link>
        </div>
      </div>
    </Card>
  );
}
