import { APP_NAME, ROUTES, SUPPORT_EMAIL } from "@/lib/constants";
import type { NotificationContent } from "@/lib/notifications/catalogue";
import { createLogger } from "@/lib/errors/logger";

/**
 * De e-mailkant van de meldingen. Vandaag een poort, morgen een provider.
 *
 * Dezelfde vorm als `lib/auth/email.ts`, met één verschil dat er echt toe doet:
 * **een mail die niet vertrekt, mag hier niets tegenhouden.** Bij auth is een
 * mail die niet aankomt een gebruiker die niet binnenraakt, dus daar hoort een
 * fout. Hier is het een melding die de gebruiker ook gewoon in de app ziet
 * staan — een render tegenhouden omdat de mailserver eruit ligt, zou van een
 * ongemak een storing maken. Alles hieronder logt dus en gooit niet.
 *
 * Aanzetten met `NOTIFICATIONS_EMAIL=1`. Staat die niet, dan wordt er niets
 * verstuurd en ook niets gelogd: in development is de console anders binnen een
 * halve dag onleesbaar door de meldingen van je eigen testrenders.
 */

const log = createLogger("notifications:email");

export function isEmailChannelEnabled(): boolean {
  return process.env.NOTIFICATIONS_EMAIL === "1";
}

export type NotificationEmail = {
  to: string;
  content: NotificationContent;
};

/**
 * Verstuurt één melding als e-mail. Geeft terug of dat gelukt is; de aanroeper
 * gebruikt dat hoogstens voor een logregel.
 */
export async function sendNotificationEmail({ to, content }: NotificationEmail): Promise<boolean> {
  if (!isEmailChannelEnabled()) return false;

  try {
    await deliver({
      to,
      subject: content.title,
      body: [
        content.body,
        "",
        content.href ? `${content.actionLabel ?? "Bekijk het in de app"}: ${absolute(content.href)}` : "",
        "",
        `Wil je hier geen mail meer over? Zet het uit bij je meldingen: ${absolute(ROUTES.account)}`,
        `Vragen? Mail ${SUPPORT_EMAIL}.`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return true;
  } catch (error) {
    // Zie de kop van dit bestand: dit hoort in de logs en niet in de aanroeper.
    log.error("melding kon niet gemaild worden", error, { to, topic: content.topic });

    return false;
  }
}

async function deliver(email: { to: string; subject: string; body: string }): Promise<void> {
  // TODO: koppel dezelfde provider als in `lib/auth/email.ts` zodra die er is.
  console.info(
    [
      "",
      "--------------------------------------------------------------",
      `[${APP_NAME}] melding naar ${email.to}`,
      `Onderwerp: ${email.subject}`,
      "",
      email.body,
      "--------------------------------------------------------------",
      "",
    ].join("\n"),
  );
}

/** Een link in een mail moet volledig zijn; in de app is hij relatief. */
function absolute(href: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  return href.startsWith("http") ? href : `${base}${href}`;
}
