"use client";

import type { ReactNode } from "react";
import { Clock, Film, ImageIcon, Monitor, Target, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ASPECT_RATIO_LABELS } from "@/lib/aspect-ratios";
import { formatDuration } from "@/lib/format";
import { estimateDurationInSeconds, secondsPerPhotoFor } from "@/lib/new-project/draft";
import { GOAL_LABELS } from "@/lib/new-project/presets";
import type { ProjectDraft, Template } from "@/types";

export type StepReviewProps = {
  draft: ProjectDraft;
  templates: Template[];
};

/**
 * Stap 6: wat er straks in de editor staat. Bewust een samenvatting en geen
 * nieuw formulier — wie iets wil wijzigen, klikt in de voortgangsindicator
 * terug naar die stap.
 */
export function StepReview({ draft, templates }: StepReviewProps) {
  const template = templates.find((item) => item.id === draft.templateId);
  const secondsPerPhoto = secondsPerPhotoFor(draft.goal);
  const duration = estimateDurationInSeconds(draft.photos.length, secondsPerPhoto);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        <SummaryRow icon={<Type />} label="Naam" value={draft.title.trim() || "—"} />
        <SummaryRow
          icon={<Target />}
          label="Doel"
          value={draft.goal ? GOAL_LABELS[draft.goal] : "—"}
        />
        <SummaryRow
          icon={<Monitor />}
          label="Beeldverhouding"
          value={draft.aspectRatio ? ASPECT_RATIO_LABELS[draft.aspectRatio] : "—"}
        />
        <SummaryRow icon={<Film />} label="Template" value={template?.name ?? "—"} />
        <SummaryRow
          icon={<ImageIcon />}
          label="Foto's"
          value={`${draft.photos.length} — evenveel scènes`}
        />
        <SummaryRow
          icon={<Clock />}
          label="Geschatte duur"
          value={formatDuration(duration)}
          hint={`${formatSeconds(secondsPerPhoto)} per foto, plus intro en outro`}
        />
      </dl>

      <p className="text-sm text-fg-muted">
        We maken het project aan met de foto&apos;s in deze volgorde en openen meteen de editor.
        Daar pas je de tijdlijn, de teksten en de muziek aan.{" "}
        <Badge variant="info" size="sm">
          Nog niets gerenderd
        </Badge>
      </p>
    </div>
  );
}

/** "2,5 s" — met de Belgische komma. */
function formatSeconds(seconds: number): string {
  return `${new Intl.NumberFormat("nl-BE").format(seconds)} s`;
}

type SummaryRowProps = {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
};

function SummaryRow({ icon, label, value, hint }: SummaryRowProps) {
  return (
    <div className="flex items-start gap-3 bg-surface px-4 py-3.5">
      <span aria-hidden="true" className="mt-0.5 text-fg-subtle [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-fg-subtle">{label}</dt>
        <dd className="text-sm font-medium break-words text-fg">{value}</dd>
        {hint ? <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p> : null}
      </div>
    </div>
  );
}
