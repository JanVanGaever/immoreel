"use client";

import { Film } from "lucide-react";
import { PreviewPlayer } from "@/components/editor/preview/preview-player";
import type { EditorController } from "@/components/editor/use-editor";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { formatDuration } from "@/lib/format";

/**
 * De preview als venster, met de exportknop ernaast.
 *
 * Die volgorde is de hele reden dat dit een dialoog is en geen paneel: kijken
 * en dan pas renderen. Wie hier ziet dat de derde foto te lang blijft staan,
 * sluit af en past dat aan — dat scheelt een render van twintig minuten die
 * toch weggegooid wordt.
 *
 * `Modal` toont zijn inhoud alleen als hij openstaat. De speler bestaat dus
 * niet zolang het venster dicht is: geen verkleinde foto's in het geheugen,
 * geen lus die op de achtergrond doortikt.
 */
export function PreviewDialog({
  editor,
  open,
  onClose,
  onExport,
}: {
  editor: EditorController;
  open: boolean;
  onClose: () => void;
  /** Meteen doorgaan naar exporteren; laat het venster zelf sluiten. */
  onExport?: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader
        title="Preview"
        description={`${editor.scenes.length} foto's · ${formatDuration(editor.durationInSeconds)} · ${editor.document.aspectRatio}`}
      />

      <PreviewPlayer document={editor.document} className="h-[min(70svh,34rem)]" />

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Sluiten
        </Button>
        {onExport ? (
          <Button onClick={onExport} disabled={editor.scenes.length === 0}>
            <Film />
            Exporteren
          </Button>
        ) : null}
      </ModalFooter>
    </Modal>
  );
}
