import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { buttonClasses } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-canvas px-6 text-center">
      <Logo />
      <div>
        <p className="text-sm font-medium text-brand">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Pagina niet gevonden</h1>
        <p className="mt-2 max-w-sm text-sm text-fg-muted">
          Deze pagina bestaat niet of is verplaatst.
        </p>
      </div>
      <Link href={ROUTES.dashboard} className={buttonClasses("primary", "md")}>
        Terug naar dashboard
      </Link>
    </div>
  );
}
