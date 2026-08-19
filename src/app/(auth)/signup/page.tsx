import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AUTH_ROUTES } from "@/lib/auth/config";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Account aanmaken" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Account aanmaken"
      description={`Je kantoor wordt meteen mee aangemaakt. Jij wordt ${ROLE_LABELS.owner.toLowerCase()} en kan later collega's uitnodigen.`}
      footer={
        <>
          Heb je al een account?{" "}
          <Link
            href={AUTH_ROUTES.login}
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            Inloggen
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
