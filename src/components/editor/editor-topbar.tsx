"use client";

import Link from "next/link";
import { ArrowLeft, Film, MonitorPlay } from "lucide-react";
import { SaveIndicator } from "@/components/editor/save-indicator";
import type { EditorController } from "@/components/editor/use-editor";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_VARIANTS } from "@/lib/project-status";
import { TITLE_MAX_LENGTH } from "@/lib/new-project/validation";
import type { ProjectStatus } from "@/types";

/**
 * De balk bovenaan: waar je bent, of je werk bewaard is, en wat je ermee doet.
 *
 * De titel is hier meteen een invoerveld. Een aparte "hernoemen"-knop zou een
 * stap toevoegen aan iets wat gewoon typen is — en autosave zorgt dat er ook
 * geen bewaarknop bij hoeft.
 */
export function EditorTopbar({
  editor,
  status,
  onPreview,
  onExport,
}: {
  editor: EditorController;
  status: ProjectStatus;
  onPreview: () => void;
  onExport: () => void;
}) {
  return (
    <header className="flex h-[var(--topbar-height)] shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <Link
        href={ROUTES.project(editor.projectId)}
        className={buttonClasses("ghost", "icon")}
        aria-label="Terug naar project"
      >
        <ArrowLeft />
      </Link>
      {/* Op een telefoon staat de pijl terug er al; een logo ernaast kost
          alleen maar plaats die de projectnaam beter kan gebruiken. */}
      <span className="hidden sm:inline-flex">
        <Logo showWordmark={false} />
      </span>

      <input
        value={editor.document.title}
        onChange={(event) => editor.setTitle(event.target.value)}
        maxLength={TITLE_MAX_LENGTH}
        aria-label="Naam van het project"
        placeholder="Naamloos project"
        className="h-9 w-24 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-fg hover:border-border focus:border-brand focus:bg-surface focus:outline-none sm:max-w-64"
      />

      {/* Op een telefoon is de plaats voor de naam belangrijker dan voor de status. */}
      <Badge variant={PROJECT_STATUS_VARIANTS[status]} className="hidden sm:inline-flex">
        {PROJECT_STATUS_LABELS[status]}
      </Badge>

      <span className="hidden text-xs text-fg-subtle tabular-nums sm:inline">
        {editor.document.aspectRatio} · {formatDuration(editor.durationInSeconds)} ·{" "}
        {editor.scenes.length} foto&apos;s
      </span>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <SaveIndicator save={editor.save} />

        {/* Eerst kijken, dan pas renderen: een export van twintig minuten is
            een dure manier om te ontdekken dat een scène te lang staat. */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onPreview}
          disabled={editor.scenes.length === 0}
        >
          <MonitorPlay />
          <span className="hidden sm:inline">Preview</span>
        </Button>

        <Button size="sm" onClick={onExport} disabled={editor.scenes.length === 0}>
          <Film />
          Exporteren
        </Button>
      </div>
    </header>
  );
}
