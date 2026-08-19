"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // TODO: koppelen aan error tracking (Sentry o.i.d.)
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={TriangleAlert}
      title="Er ging iets mis"
      description="We konden deze pagina niet laden. Probeer het opnieuw."
      action={
        <Button variant="secondary" onClick={reset}>
          Opnieuw proberen
        </Button>
      }
    />
  );
}
