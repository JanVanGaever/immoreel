import Link from "next/link";
import { Film } from "lucide-react";
import { ProjectStatusBadge } from "@/components/dashboard/project-status-badge";
import { Meter } from "@/components/ui/meter";
import { ROUTES } from "@/lib/constants";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/types";

export type ProjectListItemProps = {
  project: ProjectSummary;
  className?: string;
};

/**
 * Eén regel in een projectlijst: pand, status en wanneer er laatst aan
 * gewerkt is. De hele regel is de link naar het project.
 */
export function ProjectListItem({ project, className }: ProjectListItemProps) {
  const meta = [project.reference, project.city].filter(Boolean).join(" · ");

  return (
    <li className={className}>
      <Link
        href={ROUTES.project(project.id)}
        className={cn(
          "flex items-start gap-3 rounded-lg px-3 py-3 sm:items-center sm:gap-4",
          "transition-colors duration-150 hover:bg-surface-subtle",
        )}
      >
        {/* Posterbeeld komt later uit de renderoutput; tot dan een rustig vlak. */}
        <span
          aria-hidden="true"
          className="surface-grid flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-fg-subtle sm:size-12"
        >
          <Film className="size-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-fg">{project.title}</span>
            <ProjectStatusBadge status={project.status} />
          </span>

          <span className="mt-1 block truncate text-xs text-fg-subtle">
            {meta ? `${meta} · ` : ""}
            {project.aspectRatio}
            {project.durationInSeconds > 0 ? ` · ${formatDuration(project.durationInSeconds)}` : ""}
          </span>

          {project.status === "renderen" && typeof project.renderProgress === "number" ? (
            <Meter
              className="mt-2 max-w-xs"
              size="sm"
              value={project.renderProgress}
              max={100}
              srLabel={`Render ${project.renderProgress}% klaar`}
            />
          ) : null}

          {project.status === "mislukt" && project.errorMessage ? (
            <span className="mt-1.5 block truncate text-xs text-danger">
              {project.errorMessage}
            </span>
          ) : null}
        </span>

        <time
          dateTime={project.updatedAt}
          className="hidden shrink-0 text-xs text-fg-subtle sm:block"
        >
          {formatRelativeTime(project.updatedAt)}
        </time>
      </Link>
    </li>
  );
}

export type ProjectListProps = {
  projects: ProjectSummary[];
  className?: string;
};

/** Lijst van projecten. Zonder eigen lege staat: die kiest de gebruiker van de lijst. */
export function ProjectList({ projects, className }: ProjectListProps) {
  return (
    <ul className={cn("-mx-3 divide-y divide-border", className)}>
      {projects.map((project) => (
        <ProjectListItem key={project.id} project={project} />
      ))}
    </ul>
  );
}
