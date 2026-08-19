import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Steps, type Step } from "@/components/ui/steps";
import { ROUTES } from "@/lib/constants";

/** De weg naar de eerste video, in drie stappen. */
const onboardingSteps: Step[] = [
  {
    id: "huisstijl",
    label: "Zet je huisstijl klaar",
    description: "Logo, kleuren en lettertype — één keer instellen, altijd gebruikt.",
  },
  {
    id: "media",
    label: "Upload de foto's van een pand",
    description: "Foto's, drone-beelden en plannen; volgorde regel je later.",
  },
  {
    id: "render",
    label: "Render je eerste video",
    description: "Immoreel monteert, jij downloadt of deelt de link.",
  },
];

export type WelcomeCardProps = {
  /** Voornaam van de gebruiker, voor een menselijke aanhef. */
  firstName: string;
  /** Verbergt de knop voor rollen die geen projecten mogen aanmaken. */
  mayCreate?: boolean;
  className?: string;
};

/**
 * Wat een nieuwe organisatie ziet in plaats van lege grafieken: waar te
 * beginnen, in de volgorde waarin het werkt.
 */
export function WelcomeCard({ firstName, mayCreate = true, className }: WelcomeCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Welkom bij Immoreel, {firstName}</CardTitle>
          <CardDescription>
            Je kantoor heeft nog geen video&apos;s. In drie stappen staat de eerste klaar.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Steps
          steps={onboardingSteps}
          current={0}
          orientation="vertical"
          label="Aan de slag"
          className="mb-5"
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          {mayCreate ? (
            <Link href={ROUTES.newProject} className={buttonClasses("primary", "md")}>
              <Plus />
              Nieuwe video maken
            </Link>
          ) : null}
          <Link href={ROUTES.brandKit} className={buttonClasses("secondary", "md")}>
            Huisstijl instellen
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
