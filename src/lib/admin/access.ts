import { notFound } from "next/navigation";
import { normaliseEmail } from "@/db/auth-store";
import { requireSession, type Session } from "@/lib/auth/session";

/**
 * Wie het interne paneel mag zien.
 *
 * Dit is bewust **geen rol**. `owner`, `editor` en `viewer` gaan over wat een
 * klant binnen zijn eigen kantoor mag; het adminpaneel kijkt over alle
 * kantoren heen en hoort dus bij niemands kantoor. Een rol erbij verzinnen zou
 * betekenen dat een klant zichzelf ooit die rol kan geven — en dat is precies
 * de fout die je bij een intern paneel niet één keer mag maken.
 *
 * De lijst staat daarom in de omgeving, niet in de databank: `ADMIN_EMAILS`,
 * komma-gescheiden. Wie het paneel erbij krijgt, is een deploy, geen klik.
 *
 * Buiten development is een lege lijst gewoon een lege lijst: dan kan niemand
 * erbij, en dat is de veilige stand. In development staat het demoaccount er
 * standaard op, zodat het paneel te proberen valt zonder configuratie.
 */

/** Het demoaccount uit `src/db/auth-store.ts`; alleen buiten productie. */
const DEV_STAFF_EMAIL = "demo@immoreel.be";

/**
 * De interne adressen, genormaliseerd. Leeg betekent: niemand.
 *
 * Wordt bij elk verzoek opnieuw gelezen. Dat is een `split()` op een string —
 * goedkoper dan het risico dat een gewijzigde omgevingsvariabele pas na een
 * herstart telt.
 */
export function staffEmails(): string[] {
  const configured = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normaliseEmail(email))
    .filter(Boolean);

  if (configured.length > 0) return configured;
  if (process.env.NODE_ENV === "production") return [];

  return [DEV_STAFF_EMAIL];
}

export function isStaffEmail(email: string): boolean {
  return staffEmails().includes(normaliseEmail(email));
}

/**
 * De sessie van een interne medewerker, of een 404.
 *
 * Bewust `notFound()` en geen 403: een paneel dat aan de buitenkant laat weten
 * dat het bestaat, is een uitnodiging. Voor wie er niet bij hoort, bestaat
 * `/admin` niet.
 *
 * Dit is het tweede slot. Het eerste is `src/proxy.ts`, dat iedereen zonder
 * geldig sessiecookie al naar het inlogscherm stuurt.
 */
export async function requireStaff(): Promise<Session> {
  const session = await requireSession();
  if (!isStaffEmail(session.user.email)) notFound();

  return session;
}

/**
 * Waar de toegang vandaan komt: uit `ADMIN_EMAILS` of uit de ontwikkelstand.
 *
 * Staat op het overzicht, omdat de vraag "waarom kan mijn collega er niet bij?"
 * anders bij iemand anders belandt dan bij wie ze kan beantwoorden.
 */
export function staffSource(): "env" | "dev-default" {
  const configured = (process.env.ADMIN_EMAILS ?? "").split(",").filter((value) => value.trim());

  return configured.length > 0 ? "env" : "dev-default";
}
