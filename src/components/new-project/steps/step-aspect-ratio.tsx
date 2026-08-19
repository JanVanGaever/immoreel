"use client";

import { OptionCard, OptionGrid } from "@/components/new-project/option-card";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/field";
import { ASPECT_RATIO_OPTIONS, aspectRatioCss } from "@/lib/aspect-ratios";
import { templatesForRatio } from "@/lib/new-project/draft";
import type { AspectRatio, ProjectGoal, Template } from "@/types";
import { getGoal } from "@/lib/new-project/presets";

export type StepAspectRatioProps = {
  aspectRatio: AspectRatio | null;
  goal: ProjectGoal | null;
  templates: Template[];
  error?: string;
  onSelect: (ratio: AspectRatio) => void;
};

/** Stap 3: de beeldverhouding. Het voorstel komt uit het doel van stap 2. */
export function StepAspectRatio({
  aspectRatio,
  goal,
  templates,
  error,
  onSelect,
}: StepAspectRatioProps) {
  const suggested = goal ? getGoal(goal).preset.aspectRatio : null;

  return (
    <>
      <OptionGrid legend="Beeldverhouding">
        {ASPECT_RATIO_OPTIONS.map((option) => {
          const fitting = templatesForRatio(templates, option.id).length;

          return (
            <OptionCard
              key={option.id}
              name="aspectRatio"
              value={option.id}
              checked={aspectRatio === option.id}
              onSelect={() => onSelect(option.id)}
              title={`${option.id} — ${option.label.toLowerCase()}`}
              description={`${option.description} ${fitting} ${fitting === 1 ? "template" : "templates"}.`}
              badge={
                option.id === suggested ? (
                  <Badge variant="brand" size="sm">
                    Voorstel
                  </Badge>
                ) : null
              }
              media={
                <span className="flex h-16 items-center justify-center">
                  <span
                    aria-hidden="true"
                    className="block h-full rounded border border-border-strong bg-surface-subtle"
                    style={{ aspectRatio: aspectRatioCss(option.id) }}
                  />
                </span>
              }
            />
          );
        })}
      </OptionGrid>

      {error ? <FieldError className="mt-3">{error}</FieldError> : null}
    </>
  );
}
