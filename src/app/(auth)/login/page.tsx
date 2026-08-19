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
};

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
          variant={noticeKey === "magic-link-ongeldig" ? "warning" : "info"}
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
