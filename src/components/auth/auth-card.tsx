import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type AuthCardProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Regel onder de kaart: "Nog geen account? Registreer je." */
  footer?: ReactNode;
  className?: string;
};

/** Dezelfde opbouw voor elk auth-scherm: titel, uitleg, formulier, voetregel. */
export function AuthCard({ title, description, children, footer, className }: AuthCardProps) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <Card>
        <CardContent className="px-5 py-6 sm:px-6">
          <div className="mb-5">
            <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
            {description ? <p className="mt-1.5 text-sm text-fg-muted">{description}</p> : null}
          </div>
          {children}
        </CardContent>
      </Card>

      {footer ? <p className="text-center text-sm text-fg-muted">{footer}</p> : null}
    </div>
  );
}
