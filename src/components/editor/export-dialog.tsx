"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Film } from "lucide-react";
import {
  ExportPresetList,
  useExportBatch,
} from "@/components/editor/panels/export-selector";
import type { EditorController } from "@/components/editor/use-editor";
import { Alert } from "@/components/ui/alert";
import { ErrorSummary } from "@/components/ui/error-state";
import { Button, buttonClasses } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { exportProjectAction } from "@/lib/editor/actions";
import { ROUTES } from "@/lib/constants";
import { initialExportState, type ExportState } from "@/lib/editor/action-state";
import { formatBytes, formatDuration } from "@/lib/format";

/**
 * Exporteren: kiezen naar welke platformen, en dan pas versturen.
 *
 * De keuze zit in het document en wordt dus mee bewaard — de volgende keer
 * staat ze er nog. Bewaren gebeurt eerst: er wordt geëxporteerd wat er op de
 * server staat, niet wat er in dit tabblad open is.
 *
 * Meerdere platformen tegelijk is hier de normale gang van zaken, en daarom
 * staat onderaan wat het samen wordt: hoeveel bestanden, hoe zwaar, en onder
 * welke namen ze straks in de downloadmap staan.
 */
export function ExportDialog({
  editor,
  open,
  onClose,
}: {
  editor: EditorController;
  open: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<ExportState>(initialExportState);
  const [isPending, startTransition] = useTransition();

  const batch = useExportBatch(editor);
  const chosen = editor.document.exportPresetIds;

  function handleExport() {
    // Eerst wat er nog openstaat wegschrijven; daarna pas de opdracht.
    editor.save.saveNow();

    startTransition(async () => {
      setState(await exportProjectAction(editor.projectId, chosen));
    });
  }

  return (
    <Modal open={open} onClose={onClose} size="md" closeOnBackdropClick={false}>
      <ModalHeader
        title="Video exporteren"
        description={`${editor.scenes.length} foto's · ${formatDuration(editor.durationInSeconds)}`}
      />
      <ModalBody className="space-y-3">
        {state.status === "wachtrij" ? (
          <Alert variant="success" title={state.message}>
            <ul className="mt-1 space-y-0.5 text-xs">
              {state.requests.map((request) => (
                <li key={request.presetId}>
                  <span className="font-medium">{request.fileName}</span> — {request.format}
                  {request.isNew ? null : " · deze render liep al"}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              Je kan het venster sluiten: de render loopt door op de server. Op de downloadpagina
              zie je de voortgang en straks de bestanden zelf.
            </p>
          </Alert>
        ) : null}

        {state.status === "fout" ? <ErrorSummary error={state.message} /> : null}

        <ExportPresetList editor={editor} />

        <ExportSummary
          count={batch.items.length}
          totalSizeInBytes={batch.totalEstimatedSizeInBytes}
          blockingMessage={batch.blocking[0]?.message ?? null}
        />
      </ModalBody>
      <ModalFooter>
        {state.status === "wachtrij" ? (
          <Link
            href={ROUTES.projectExports(editor.projectId)}
            className={buttonClasses("secondary", "md", "mr-auto")}
          >
            <Download />
            Naar de downloads
          </Link>
        ) : null}

        <Button variant="secondary" onClick={onClose}>
          Sluiten
        </Button>
        <Button onClick={handleExport} disabled={!batch.canExport} isLoading={isPending}>
          <Film />
          {batch.items.length > 1 ? `${batch.items.length} exports starten` : "Export starten"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/** Wat de hele batch samen wordt; de schatting is een plafond, geen belofte. */
function ExportSummary({
  count,
  totalSizeInBytes,
  blockingMessage,
}: {
  count: number;
  totalSizeInBytes: number;
  blockingMessage: string | null;
}) {
  if (blockingMessage) {
    return (
      <p className="flex items-start gap-1.5 rounded-md border border-danger/40 bg-danger-soft/40 p-2 text-xs text-danger">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        {blockingMessage}
      </p>
    );
  }

  if (count === 0) {
    return (
      <p className="rounded-md border border-border bg-surface-subtle p-2 text-xs text-fg-muted">
        Kies minstens één platform om naar te exporteren.
      </p>
    );
  }

  return (
    <p className="rounded-md border border-border bg-surface-subtle p-2 text-xs text-fg-muted">
      {count} {count === 1 ? "bestand" : "bestanden"} · samen ongeveer{" "}
      <span className="tabular-nums">{formatBytes(totalSizeInBytes)}</span>. Elk platform krijgt
      zijn eigen render; ze lopen naast elkaar in de wachtrij.
    </p>
  );
}
