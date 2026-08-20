"use client";

import { useState } from "react";
import { Images, MonitorPlay, SlidersHorizontal } from "lucide-react";
import { EditorTopbar } from "@/components/editor/editor-topbar";
import { ExportDialog } from "@/components/editor/export-dialog";
import { PreviewDialog } from "@/components/editor/preview/preview-dialog";
import { AssetPanel } from "@/components/editor/panels/asset-panel";
import { SettingsPanel } from "@/components/editor/panels/settings-panel";
import { StagePanel } from "@/components/editor/panels/stage-panel";
import { useEditor } from "@/components/editor/use-editor";
import type { EditorDocument } from "@/lib/editor/document";
import { cn } from "@/lib/utils";
import type { ID, ProjectStatus, Template } from "@/types";

/**
 * De editor: foto's links, preview in het midden, instellingen rechts.
 *
 * Dit bestand doet niet meer dan die drie naast elkaar zetten en ze dezelfde
 * controller geven. Alle staat komt uit `useEditor`, dus een paneel toevoegen
 * of vervangen raakt niets anders.
 *
 * Op een smal scherm is er geen plaats voor drie kolommen. In plaats van de
 * zijpanelen te verbergen — waarmee de editor half onbruikbaar wordt — schakelt
 * een balk onderaan tussen de drie.
 */

export type EditorShellProps = {
  projectId: ID;
  status: ProjectStatus;
  initialDocument: EditorDocument;
  templates: Template[];
};

type Pane = "fotos" | "preview" | "instellingen";

const PANES: { id: Pane; label: string; icon: typeof Images }[] = [
  { id: "fotos", label: "Foto's", icon: Images },
  { id: "preview", label: "Preview", icon: MonitorPlay },
  { id: "instellingen", label: "Instellingen", icon: SlidersHorizontal },
];

export function EditorShell({ projectId, status, initialDocument, templates }: EditorShellProps) {
  const editor = useEditor({ projectId, initialDocument, templates });
  const [pane, setPane] = useState<Pane>("preview");
  const [isPreviewing, setPreviewing] = useState(false);
  const [isExporting, setExporting] = useState(false);

  return (
    <>
      <EditorTopbar
        editor={editor}
        status={status}
        onPreview={() => setPreviewing(true)}
        onExport={() => setExporting(true)}
      />

      <div className="flex min-h-0 flex-1">
        <AssetPanel
          editor={editor}
          className={cn(
            "w-full shrink-0 border-r border-border lg:flex lg:w-72 xl:w-80",
            pane === "fotos" ? "flex" : "hidden",
          )}
        />

        <StagePanel
          editor={editor}
          className={cn("flex-1 lg:flex", pane === "preview" ? "flex" : "hidden")}
        />

        <SettingsPanel
          editor={editor}
          className={cn(
            "w-full shrink-0 border-l border-border lg:flex lg:w-80",
            pane === "instellingen" ? "flex" : "hidden",
          )}
        />
      </div>

      <nav
        aria-label="Onderdelen van de editor"
        className="flex shrink-0 border-t border-border bg-surface lg:hidden"
      >
        {PANES.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPane(item.id)}
              aria-current={pane === item.id || undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.6875rem] font-medium",
                pane === item.id ? "text-brand" : "text-fg-muted",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <PreviewDialog
        editor={editor}
        open={isPreviewing}
        onClose={() => setPreviewing(false)}
        onExport={() => {
          // Twee vensters tegelijk open is er één te veel.
          setPreviewing(false);
          setExporting(true);
        }}
      />

      <ExportDialog editor={editor} open={isExporting} onClose={() => setExporting(false)} />
    </>
  );
}
