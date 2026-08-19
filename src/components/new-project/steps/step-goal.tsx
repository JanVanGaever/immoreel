"use client";

import { OptionCard, OptionGrid } from "@/components/new-project/option-card";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/field";
import { formatNumber } from "@/lib/format";
import { GOAL_OPTIONS } from "@/lib/new-project/presets";
import type { ProjectGoal } from "@/types";

export type StepGoalProps = {
  goal: ProjectGoal | null;
  error?: string;
  onSelect: (goal: ProjectGoal) => void;
};

/**
 * Stap 2: het doel. Dit is de stap die de rest van de wizard kort maakt —
 * formaat, template en tempo staan hierna al ingevuld.
 */
export function StepGoal({ goal, error, onSelect }: StepGoalProps) {
  return (
    <>
      <OptionGrid legend="Waar komt de video terecht?" columns={3}>
        {GOAL_OPTIONS.map((option) => (
          <OptionCard
            key={option.id}
            name="goal"
            value={option.id}
            checked={goal === option.id}
            onSelect={() => onSelect(option.id)}
            title={option.label}
            description={option.description}
            icon={option.icon}
            badge={
              goal === option.id ? (
                <Badge variant="brand" size="sm">
                  Gekozen
                </Badge>
              ) : null
            }
            media={
              <span className="text-[0.6875rem] font-medium tracking-wide text-fg-subtle uppercase">
                {option.preset.aspectRatio} · scènes van {formatNumber(option.preset.secondsPerPhoto)} s
              </span>
            }
          />
        ))}
      </OptionGrid>

      {error ? <FieldError className="mt-3">{error}</FieldError> : null}
    </>
  );
}
