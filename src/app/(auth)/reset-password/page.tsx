import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { AUTH_ROUTES } from "@/lib/auth/config";
import { firstSearchParam } from "@/lib/utils";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nieuw wachtwoord" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const token = firstSearchParam((await searchParams).token);

  // Het token wordt hier alleen op aanwezigheid gecontroleerd. Of het geldig
  // is, blijkt pas bij het opslaan: zo is er geen scherm dat verraadt welke
  // tokens bestaan.
  if (!token) {
    return (
      <AuthCard
        title="Link onvolledig"
        description="Deze pagina hoort bij de herstelmail die we je stuurden."
      >
        <div className="flex flex-col gap-4">
          <Alert variant="warning" title="Er staat geen geldige code in de link.">
            Open de link uit de e-mail opnieuw, of vraag een nieuwe aan.
          </Alert>
          <Link href={AUTH_ROUTES.forgotPassword} className={buttonClasses("primary", "md")}>
            Nieuwe herstellink aanvragen
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Nieuw wachtwoord instellen"
      description="Kies een wachtwoord dat je nergens anders gebruikt. Je wordt daarna meteen ingelogd."
      footer={
        <Link
          href={AUTH_ROUTES.login}
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          Terug naar inloggen
        </Link>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
