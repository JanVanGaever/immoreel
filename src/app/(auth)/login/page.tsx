import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Alert } from "@/components/ui/alert";
import { AUTH_ROUTES, safeRedirectPath } from "@/lib/auth/config";
import { firstSearchParam } from "@/lib/utils";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Inloggen" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Meldingen die andere schermen via `?melding=` kunnen doorgeven. */
const NOTICES: Record<string, string> = {
  "magic-link-ongeldig": "Die inloglink is verlopen of al gebruikt. Vraag een nieuwe aan.",
  uitgelogd: "Je bent uitgelogd.",
  "sessie-verlopen": "Je sessie is verlopen. Log opnieuw in om verder te werken.",
  "account-verwijderd": "Je account is verwijderd. Bedankt voor het gebruik van Immoreel.",
  "e-mailadres-gewijzigd": "Je nieuwe e-mailadres is bevestigd. Log ermee in.",
  "e-mail-link-ongeldig": "Die bevestigingslink is verlopen of al gebruikt. Vraag een nieuwe aan.",
  "e-mail-bezet": "Dat e-mailadres is intussen door iemand anders in gebruik genomen.",
};

/** Meldingen die eerder een waarschuwing zijn dan een mededeling. */
const WARNINGS = new Set(["magic-link-ongeldig", "e-mail-link-ongeldig", "e-mail-bezet"]);

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const redirectTo = safeRedirectPath(firstSearchParam(params.redirectTo));
  const noticeKey = firstSearchParam(params.melding);
  const notice = noticeKey ? NOTICES[noticeKey] : undefined;

  return (
    <AuthCard
      title="Inloggen"
      description="Welkom terug. Log in om verder te werken aan je vastgoedvideo's."
      footer={
        <>
          Nog geen account?{" "}
          <Link href={AUTH_ROUTES.signup} className="font-medium text-brand underline-offset-2 hover:underline">
            Maak er een aan
          </Link>
        </>
      }
    >
      {notice ? (
        <Alert
          variant={noticeKey && WARNINGS.has(noticeKey) ? "warning" : "info"}
          title={notice}
          className="mb-4"
        />
      ) : null}

      {redirectTo ? (
        <Alert variant="info" title="Log eerst in om deze pagina te bekijken." className="mb-4" />
      ) : null}

      <LoginForm redirectTo={redirectTo ?? undefined} />
    </AuthCard>
  );
}
