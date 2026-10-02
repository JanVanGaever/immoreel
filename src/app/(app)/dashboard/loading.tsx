import { Skeleton, SkeletonPageHeader, SkeletonScreen } from "@/components/ui/skeleton";

/**
 * Laadscherm van het dashboard: dezelfde vorm als de pagina zelf — de strook
 * met statussen, de brede kaart links en de smalle kolom rechts. Zo staat
 * alles bij aankomst waar het al leek te staan.
 */
export default function DashboardLoading() {
  return (
    <SkeletonScreen label="Dashboard wordt geladen">
      <SkeletonPageHeader />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl sm:h-28" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-32 rounded-xl sm:col-span-2 lg:col-span-1" />
        </div>
      </div>
    </SkeletonScreen>
  );
}
