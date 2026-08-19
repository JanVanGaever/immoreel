import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { APP_TAGLINE, SUPPORT_EMAIL } from "@/lib/constants";

/**
 * Shell voor de uitgelogde schermen: geen sidebar, geen topbar, alleen het
 * merk en het formulier. Bewust smal, zodat de aandacht bij het formulier ligt.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <header className="flex h-[var(--topbar-height)] items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Naar de startpagina">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          {children}
          <p className="mt-8 text-center text-xs text-fg-subtle">{APP_TAGLINE}</p>
        </div>
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-fg-subtle sm:px-6">
        Vragen? Mail{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-fg-muted underline underline-offset-2">
          {SUPPORT_EMAIL}
        </a>
      </footer>
    </div>
  );
}
