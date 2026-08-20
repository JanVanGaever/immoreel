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
 *
 * Daartussen zit een tablet. Op zo'n scherm passen er twee kolommen, en dan is
 * één kolom tonen zonde van de ruimte: het beeld blijft er staan en de balk
 * onderaan kiest welk zijpaneel ernaast komt. "Preview" zet ze allebei weg en
 * geeft het beeld de volle breedte. Wie aan een scène werkt wil zien wat de
 * knop doet die hij net verzet — dat is precies wat op een telefoon niet kan
 * en hier wel.
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
            "shrink-0 border-r border-border lg:flex lg:w-72 xl:w-80",
            // Telefoon: de volle breedte. Tablet: een kolom naast het beeld.
            pane === "fotos" ? "flex w-full md:w-64" : "hidden",
          )}
        />

        <StagePanel
          editor={editor}
          // Vanaf een tablet blijft het beeld staan, wat er ook gekozen is.
          className={cn("min-w-0 flex-1", pane === "preview" ? "flex" : "hidden md:flex")}
        />

        <SettingsPanel
          editor={editor}
          className={cn(
            "shrink-0 border-l border-border lg:flex lg:w-80",
            pane === "instellingen" ? "flex w-full md:w-72" : "hidden",
          )}
        />
      </div>

      <nav
        aria-label="Onderdelen van de editor"
        className={cn(
          "flex shrink-0 border-t border-border bg-surface lg:hidden",
          // Boven de streep voor het thuisgebaar op een iPhone.
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        {PANES.map((item) => {
          const Icon = item.icon;
          const active = pane === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPane(item.id)}
              aria-current={active || undefined}
              className={cn(
                "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-2",
                "text-[0.6875rem] font-medium transition-colors",
                active
                  ? "text-brand shadow-[inset_0_2px_0_0_var(--color-brand)]"
                  : "text-fg-muted hover:text-fg",
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
