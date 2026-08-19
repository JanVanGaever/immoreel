"use client";

import { Check, Wand2 } from "lucide-react";
import type { EditorController } from "@/components/editor/use-editor";
import { Button } from "@/components/ui/button";
import { getTransition, templateStyle } from "@/lib/editor/templates";
import { templatesForRatio } from "@/lib/new-project/draft";
import { formatSeconds } from "@/lib/format";
import { MOTION_LABELS } from "@/lib/editor/motion";
import { cn } from "@/lib/utils";

/**
 * Het template van de video.
 *
 * Alleen templates die de gekozen beeldverhouding aankunnen staan in de lijst
 * — dezelfde regel als in de wizard. Een template kiezen verandert de intro,
 * de outro en wat een nieuwe foto standaard krijgt; het raakt bewust niet aan
 * de scènes die er al staan. Wie dat wél wil, duwt op "Stijl toepassen":
 * twaalf zorgvuldig ingestelde bewegingen mogen niet met één klik verdwijnen
 * zonder dat je erom vraagt.
 */
export function TemplateSelector({ editor }: { editor: EditorController }) {
  const fitting = templatesForRatio(editor.templates, editor.document.aspectRatio);

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {fitting.map((template) => {
          const isActive = template.id === editor.document.templateId;
          const style = templateStyle(template.id);

          return (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => editor.chooseTemplate(template.id)}
                aria-pressed={isActive}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md border p-2 text-left",
                  "transition-[border-color,background-color] duration-150",
                  isActive
                    ? "border-brand bg-brand-soft/60"
                    : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-fg">{template.name}</span>
                  <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-fg-muted">
                    {template.description}
                  </span>
                  <span className="mt-1 block text-[0.625rem] text-fg-subtle">
                    {formatSeconds(style.secondsPerPhoto)} per foto ·{" "}
                    {MOTION_LABELS[style.motion.kind].toLowerCase()} ·{" "}
                    {getTransition(style.transition).label.toLowerCase()}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    isActive ? "border-brand bg-brand text-brand-fg" : "border-border-strong",
                  )}
                >
                  {isActive ? <Check className="size-2.5" /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={editor.scenes.length === 0}
        onClick={editor.applyTemplateStyle}
      >
        <Wand2 />
        Stijl toepassen op alle scènes
      </Button>
    </div>
  );
}
