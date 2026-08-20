import { APP_NAME, SUPPORT_EMAIL } from "@/lib/constants";

/**
 * Verzendplaats voor auth-mails.
 *
 * Er is nog geen e-mailprovider gekozen, dus in development wordt de link naar
 * de console geschreven — zo zijn wachtwoordherstel en magic link volledig
 * te testen. Zodra er een provider is (Postmark, Resend, SES), vervang je
 * alleen `deliver()` hieronder.
 */

type AuthEmail = {
  to: string;
  subject: string;
  /** Platte tekst; de HTML-versie komt samen met de provider. */
  body: string;
  /** De link die in de mail staat, apart zodat dev'ers hem kunnen kopiëren. */
  link: string;
};

async function deliver(email: AuthEmail): Promise<void> {
  // TODO: koppel de e-mailprovider en verstuur hier echt.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Geen e-mailprovider aangesloten: auth-mails kunnen niet verstuurd worden. Zie src/lib/auth/email.ts.",
    );
  }

  console.info(
    [
      "",
      "--------------------------------------------------------------",
      `[${APP_NAME}] e-mail naar ${email.to}`,
      `Onderwerp: ${email.subject}`,
      "",
      email.body,
      "",
      `Link: ${email.link}`,
      "--------------------------------------------------------------",
      "",
    ].join("\n"),
  );
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<void> {
  await deliver({
    to,
    link,
    subject: `Wachtwoord opnieuw instellen voor ${APP_NAME}`,
    body: [
      "Je vroeg een nieuw wachtwoord aan.",
      "Klik op de link hieronder om er een in te stellen. De link is één uur geldig.",
      `Niets aangevraagd? Dan hoef je niets te doen. Twijfel je? Mail ${SUPPORT_EMAIL}.`,
    ].join("\n"),
  });
}

export type TeamInvite = {
  organisationName: string;
  inviterName: string;
  /** De rol in gewone taal ("Editor"), niet de sleutel. */
  roleLabel: string;
};

export async function sendTeamInviteEmail(
  to: string,
  link: string,
  invite: TeamInvite,
): Promise<void> {
  await deliver({
    to,
    link,
    subject: `${invite.inviterName} nodigt je uit bij ${invite.organisationName} op ${APP_NAME}`,
    body: [
      `${invite.inviterName} wil met je samenwerken in ${invite.organisationName}.`,
      `Je komt binnen als ${invite.roleLabel.toLowerCase()}.`,
      "",
      "Klik op de link hieronder om je account af te werken. De link is zeven dagen",
      "geldig en werkt één keer.",
      `Ken je deze uitnodiging niet? Negeer deze mail of laat het weten via ${SUPPORT_EMAIL}.`,
    ].join("\n"),
  });
}

export async function sendMagicLinkEmail(to: string, link: string): Promise<void> {
  await deliver({
    to,
    link,
    subject: `Je inloglink voor ${APP_NAME}`,
    body: [
      "Klik op de link hieronder om in te loggen. De link is 15 minuten geldig",
      "en werkt één keer.",
      "Niet zelf aangevraagd? Negeer deze mail.",
    ].join("\n"),
  });
}
