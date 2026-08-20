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

/**
 * Bevestiging van een nieuw e-mailadres, naar het **nieuwe** adres. Pas wie
 * daar bij de mailbox kan, krijgt het adres op zijn account.
 */
export async function sendEmailChangeConfirmation(to: string, link: string): Promise<void> {
  await deliver({
    to,
    link,
    subject: `Bevestig je nieuwe e-mailadres voor ${APP_NAME}`,
    body: [
      "Je vroeg aan om dit adres te gebruiken om in te loggen bij Immoreel.",
      "Klik op de link hieronder om dat te bevestigen. De link is één uur geldig",
      "en werkt één keer.",
      "Niets aangevraagd? Dan hoef je niets te doen: zonder deze klik verandert er niets.",
    ].join("\n"),
  });
}

/**
 * Waarschuwing naar het **oude** adres. Die mail is het vangnet: wie zijn
 * account kwijtraakt aan iemand anders, hoort dat te zien op het adres dat hij
 * nog wél leest.
 */
export async function sendEmailChangeNotice(to: string, newEmail: string): Promise<void> {
  await deliver({
    to,
    link: `mailto:${SUPPORT_EMAIL}`,
    subject: `Er is een ander e-mailadres aangevraagd voor je ${APP_NAME}-account`,
    body: [
      `Iemand vroeg aan om ${newEmail} te gebruiken om in te loggen op je account.`,
      "Was jij dat? Dan hoef je niets te doen.",
      `Was jij dat niet, verander dan meteen je wachtwoord en mail ${SUPPORT_EMAIL}.`,
    ].join("\n"),
  });
}

/** Bevestiging dat het wachtwoord gewijzigd is. Ook dit hoort gemeld te worden. */
export async function sendPasswordChangedNotice(to: string): Promise<void> {
  await deliver({
    to,
    link: `mailto:${SUPPORT_EMAIL}`,
    subject: `Je wachtwoord voor ${APP_NAME} is gewijzigd`,
    body: [
      "Het wachtwoord van je account is zonet gewijzigd.",
      `Was jij dat niet? Mail dan meteen ${SUPPORT_EMAIL}.`,
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
