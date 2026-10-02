import { Skeleton, SkeletonScreen } from "@/components/ui/skeleton";

/**
 * Laadscherm van de editor.
 *
 * De editor vult het hele scherm en heeft geen paginakop; het algemene
 * laadscherm van de app past hier dus niet. Dit volgt de shell: een balk
 * bovenaan, drie kolommen eronder, en op een smal scherm alleen het beeld —
 * precies wat de editor er straks zelf van maakt.
 */
export default function EditorLoading() {
  return (
    <SkeletonScreen label="Editor wordt geladen" className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-full flex-col">
        <div className="flex h-[var(--topbar-height)] shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-4 w-32 sm:w-48" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md max-sm:hidden" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="hidden shrink-0 space-y-2 border-r border-border bg-surface-subtle p-3 md:block md:w-64 lg:w-72 xl:w-80">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>

          <div className="surface-grid flex min-h-0 flex-1 items-center justify-center p-4 sm:p-6">
            <Skeleton className="h-full max-h-80 w-full max-w-2xl rounded-lg" />
          </div>

          <div className="hidden shrink-0 space-y-3 border-l border-border bg-surface-subtle p-3 lg:block lg:w-80">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-lg" />
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-surface p-3">
          <Skeleton className="h-16 rounded-lg" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
