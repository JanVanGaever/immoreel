"use client";

import { useState, type DragEvent } from "react";
import { Images } from "lucide-react";
import { AssetRow } from "@/components/editor/panels/asset-row";
import { BulkEditBar } from "@/components/editor/panels/bulk-edit-bar";
import { EditorPanel } from "@/components/editor/panel";
import type { EditorController } from "@/components/editor/use-editor";
import { UploadZone } from "@/components/upload/upload-zone";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MAX_SCENES } from "@/lib/editor/document";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Eigen sleeptype, zodat verplaatsen niet te verwarren is met een upload. */
const REORDER_TYPE = "application/x-immoreel-scene-index";

/**
 * De foto's van deze video, in de volgorde waarin ze in beeld komen.
 *
 * De volgorde zit in de lijst zelf en nergens anders: verslepen is dus niets
 * meer dan een index die verhuist. Dezelfde afspraak als in de uploadflow.
 */
export function AssetPanel({ editor, className }: { editor: EditorController; className?: string }) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const { scenes, uploads } = editor;
  const room = Math.max(MAX_SCENES - scenes.length, 0);
  const allSelected = scenes.length > 0 && editor.state.selectedSceneIds.length === scenes.length;

  function handleDragStart(event: DragEvent<HTMLLIElement>, index: number) {
    event.dataTransfer.effectAllowed = "move";
    // De verplaatsing gaat mee in de drag zelf: tijdens `dragover` is alleen
    // het type leesbaar, en bij `drop` staat de index er nog zoals hij vertrok.
    event.dataTransfer.setData(REORDER_TYPE, String(index));
    event.dataTransfer.setData("text/plain", String(index));
    setDraggingIndex(index);
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, index: number) {
    if (!event.dataTransfer.types.includes(REORDER_TYPE)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropIndex(index);
  }

  function handleDrop(event: DragEvent<HTMLLIElement>, index: number) {
    const raw = event.dataTransfer.getData(REORDER_TYPE);
    if (!raw) return;

    const fromIndex = Number(raw);
    if (!Number.isInteger(fromIndex)) return;

    event.preventDefault();
    // Niet naar de sleepzone laten doorlekken: dit is een verplaatsing.
    event.stopPropagation();
    editor.reorderScenes(fromIndex, index);
    handleDragEnd();
  }

  function handleDragEnd() {
    setDraggingIndex(null);
    setDropIndex(null);
  }

  return (
    <EditorPanel
      title="Foto's"
      className={className}
      actions={
        <>
          <span className="text-[0.6875rem] text-fg-subtle tabular-nums">
            {scenes.length} · {formatDuration(editor.durationInSeconds)}
          </span>
          {scenes.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-[0.6875rem]"
              onClick={allSelected ? editor.clearSelection : editor.selectAll}
            >
              {allSelected ? "Geen" : "Alles"}
            </Button>
          ) : null}
        </>
      }
      sticky={
        <div className="space-y-2">
          <UploadZone
            compact
            onFiles={editor.addFiles}
            disabled={room === 0}
            disabledReason={`Maximaal ${MAX_SCENES} foto's per video.`}
            title="Sleep foto's hierheen"
            buttonLabel="Toevoegen"
          />
          {uploads.rejections.length > 0 ? (
            <Alert
              variant="warning"
              className="text-xs"
              title={`${uploads.rejections.length} bestand(en) overgeslagen`}
            >
              <ul className="space-y-0.5">
                {uploads.rejections.slice(0, 3).map((rejection) => (
                  <li key={rejection.fileName} className="truncate">
                    {rejection.fileName}: {rejection.reason}
                  </li>
                ))}
              </ul>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-6 px-1.5 text-[0.6875rem]"
                onClick={uploads.clearRejections}
              >
                Verbergen
              </Button>
            </Alert>
          ) : null}
        </div>
      }
      footer={<BulkEditBar editor={editor} />}
    >
      {scenes.length === 0 ? (
        <p className="flex flex-col items-center gap-2 p-6 text-center text-xs text-fg-muted">
          <Images aria-hidden="true" className="size-5 text-fg-subtle" />
          Nog geen foto&apos;s. Voeg ze hierboven toe; elke foto wordt één scène in de tijdlijn.
        </p>
      ) : (
        <ol
          aria-label="Foto's van deze video, in volgorde"
          className={cn("space-y-1.5 p-2")}
          onDragEnd={handleDragEnd}
        >
          {scenes.map((scene, index) => (
            <AssetRow
              key={scene.id}
              scene={scene}
              index={index}
              total={scenes.length}
              isActive={editor.state.activeSceneId === scene.id}
              isSelected={editor.state.selectedSceneIds.includes(scene.id)}
              isDragging={draggingIndex === index}
              isDropTarget={dropIndex === index && draggingIndex !== index}
              onSelect={editor.selectScene}
              onRemove={(sceneId) => editor.removeScenes([sceneId])}
              onRetry={editor.retryScene}
              onMove={editor.moveScene}
              onDuration={(sceneId, seconds) => editor.setDuration(seconds, [sceneId])}
              onMotion={(sceneId, changes) => editor.updateMotion(changes, [sceneId])}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))}
        </ol>
      )}
    </EditorPanel>
  );
}
