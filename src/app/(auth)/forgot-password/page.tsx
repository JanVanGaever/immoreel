import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AUTH_ROUTES } from "@/lib/auth/config";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Wachtwoord vergeten" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Wachtwoord vergeten"
      description="Vul je e-mailadres in. Als er een account bij hoort, sturen we je een herstellink."
      footer={
        <Link
          href={AUTH_ROUTES.login}
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          Terug naar inloggen
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
