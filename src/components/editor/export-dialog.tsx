"use client";

import { useState, useTransition } from "react";
import { Film } from "lucide-react";
import { collectWarnings, ExportPresetList } from "@/components/editor/panels/export-selector";
import type { EditorController } from "@/components/editor/use-editor";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { exportProjectAction } from "@/lib/editor/actions";
import { initialExportState, type ExportState } from "@/lib/editor/action-state";
import { formatDuration } from "@/lib/format";

/**
 * Exporteren: kiezen naar welke platformen, en dan pas versturen.
 *
 * De keuze zit in het document en wordt dus mee bewaard — de volgende keer
 * staat ze er nog. Bewaren gebeurt eerst: er wordt geëxporteerd wat er op de
 * server staat, niet wat er in dit tabblad open is.
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

  const chosen = editor.document.exportPresetIds;
  const blocking = collectWarnings(editor).filter((warning) => warning.level === "blokkerend");
  const canExport = chosen.length > 0 && blocking.length === 0 && editor.scenes.length > 0;

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
                  {request.label} — {request.format}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              De renderpijplijn staat nog niet aan; het project staat wel in de wachtrij en de
              instellingen zijn bewaard.
            </p>
          </Alert>
        ) : null}

        {state.status === "fout" ? <Alert variant="danger" title={state.message} /> : null}

        <ExportPresetList editor={editor} />
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Sluiten
        </Button>
        <Button onClick={handleExport} disabled={!canExport} isLoading={isPending}>
          <Film />
          {chosen.length > 1 ? `${chosen.length} exports starten` : "Export starten"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
