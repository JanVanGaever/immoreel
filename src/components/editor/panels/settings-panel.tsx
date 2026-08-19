"use client";

import { AspectRatioSelector } from "@/components/editor/panels/aspect-ratio-selector";
import { AudioSelector } from "@/components/editor/panels/audio-selector";
import { BrandingSelector } from "@/components/editor/panels/branding-selector";
import { ExportPresetList } from "@/components/editor/panels/export-selector";
import { SceneSettings } from "@/components/editor/panels/scene-settings";
import { TemplateSelector } from "@/components/editor/panels/template-selector";
import { PanelSection, PanelStat } from "@/components/editor/panel";
import type { EditorController } from "@/components/editor/use-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { projectTransition, scenesDuration } from "@/lib/editor/document";
import { getTransition } from "@/lib/editor/templates";
import { formatDuration, formatSeconds } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Het rechterpaneel: alles wat je instelt zonder iets te verslepen.
 *
 * Twee tabbladen, omdat er twee soorten instellingen zijn: die van één foto
 * (of van de selectie) en die van de video als geheel. Elk blok eronder is een
 * losse component — een paneel uitbreiden is er één toevoegen, niet dit
 * bestand groter maken.
 */
export function SettingsPanel({
  editor,
  className,
}: {
  editor: EditorController;
  className?: string;
}) {
  return (
    <section className={cn("flex min-h-0 flex-col bg-surface-subtle", className)}>
      <Tabs defaultValue="scene" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex h-11 shrink-0 items-center border-b border-border px-3">
          <TabsList className="border-0">
            <TabsTrigger value="scene">Scène</TabsTrigger>
            <TabsTrigger value="video">Video</TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <TabsContent value="scene">
            <SceneSettings editor={editor} />
          </TabsContent>

          <TabsContent value="video">
            <PanelSection title="Beeldverhouding">
              <AspectRatioSelector
                value={editor.document.aspectRatio}
                onChange={editor.setAspectRatio}
              />
            </PanelSection>

            <PanelSection title="Template">
              <TemplateSelector editor={editor} />
            </PanelSection>

            <PanelSection title="Huisstijl">
              <BrandingSelector editor={editor} />
            </PanelSection>

            <PanelSection title="Muziek">
              <AudioSelector editor={editor} />
            </PanelSection>

            <PanelSection
              title="Exporteren naar"
              description="Wat je hier aanvinkt, staat klaar bij het exporteren bovenaan."
            >
              <ExportPresetList editor={editor} />
            </PanelSection>

            <PanelSection title="Samenvatting">
              <div className="space-y-1">
                <PanelStat label="Foto's" value={editor.scenes.length} />
                <PanelStat
                  label="Beeld"
                  value={formatSeconds(scenesDuration(editor.document))}
                />
                <PanelStat
                  label="Intro en outro"
                  value={formatSeconds(
                    editor.style.introSeconds +
                      (editor.document.branding.showContactCard ? editor.style.outroSeconds : 0),
                  )}
                />
                <PanelStat
                  label="Overgang"
                  value={
                    projectTransition(editor.document)
                      ? getTransition(projectTransition(editor.document)!).label
                      : "Gemengd"
                  }
                />
                <PanelStat label="Totaal" value={formatDuration(editor.durationInSeconds)} />
              </div>
            </PanelSection>
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}
