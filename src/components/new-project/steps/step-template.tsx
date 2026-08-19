"use client";

import { Play } from "lucide-react";
import { OptionCard, OptionGrid } from "@/components/new-project/option-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError } from "@/components/ui/field";
import { aspectRatioCss } from "@/lib/aspect-ratios";
import { templatesForRatio } from "@/lib/new-project/draft";
import { getGoal } from "@/lib/new-project/presets";
import type { AspectRatio, ID, ProjectGoal, Template } from "@/types";

export type StepTemplateProps = {
  templates: Template[];
  templateId: ID | null;
  aspectRatio: AspectRatio | null;
  goal: ProjectGoal | null;
  error?: string;
  onSelect: (templateId: ID) => void;
};

/**
 * Stap 4: het template. We tonen alleen wat in de gekozen verhouding past —
 * een template kiezen dat niet kan renderen, hoeft de gebruiker niet te leren.
 */
export function StepTemplate({
  templates,
  templateId,
  aspectRatio,
  goal,
  error,
  onSelect,
}: StepTemplateProps) {
  const fitting = aspectRatio ? templatesForRatio(templates, aspectRatio) : templates;
  const recommended = goal ? getGoal(goal).preset.templateId : null;

  if (fitting.length === 0) {
    return (
      <EmptyState
        icon={Play}
        title="Geen template voor deze verhouding"
        description="Kies in de vorige stap een andere beeldverhouding."
      />
    );
  }

  return (
    <>
      <OptionGrid legend="Template" columns={3}>
        {fitting.map((template) => (
          <OptionCard
            key={template.id}
            name="templateId"
            value={template.id}
            checked={templateId === template.id}
            onSelect={() => onSelect(template.id)}
            title={template.name}
            description={template.description ?? undefined}
            badge={
              template.id === recommended ? (
                <Badge variant="brand" size="sm">
                  Aanbevolen
                </Badge>
              ) : null
            }
            media={
              <span className="flex h-24 items-center justify-center">
                <span
                  aria-hidden="true"
                  className="surface-grid flex h-full items-center justify-center rounded border border-border-strong bg-surface-subtle text-fg-subtle"
                  style={{ aspectRatio: aspectRatioCss(aspectRatio ?? template.aspectRatios[0]!) }}
                >
                  <Play className="size-4" />
                </span>
              </span>
            }
          />
        ))}
      </OptionGrid>

      {error ? <FieldError className="mt-3">{error}</FieldError> : null}
    </>
  );
}
