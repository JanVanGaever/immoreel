import { Skeleton, SkeletonPageHeader, SkeletonScreen } from "@/components/ui/skeleton";

/**
 * Het laadscherm voor elke pagina in de app die er zelf geen heeft.
 *
 * Bewust neutraal: een kop en één vlak. Een skelet dat een vorm belooft die de
 * pagina niet heeft, laat het scherm bij aankomst verspringen — en dat valt
 * meer op dan de wachttijd zelf. Pagina's met een eigen, herkenbare vorm
 * (dashboard, editor) zetten er hun eigen laadscherm naast.
 */
export default function Loading() {
  return (
    <SkeletonScreen>
      <SkeletonPageHeader />
      <Skeleton className="h-64 rounded-xl sm:h-80" />
    </SkeletonScreen>
  );
}
