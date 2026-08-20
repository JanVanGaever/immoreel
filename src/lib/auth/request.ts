import { headers } from "next/headers";
import { getAppUrl } from "@/lib/auth/config";

/**
 * Twee dingen die elke actie met een e-maillink of een rem erop nodig heeft.
 *
 * Ze staan hier en niet in `actions.ts`, omdat een "use server"-bestand alles
 * wat het exporteert als endpoint aanbiedt: een helper hoort geen serveractie
 * te worden.
 */

/** Sleutel voor de rate limiter: het IP van de bezoeker plus wat hij probeert. */
export async function clientKey(suffix: string): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headerList.get("x-real-ip") || "onbekend";

  return `${ip}:${suffix}`;
}

/**
 * Volledige URL voor in een e-mail. `NEXT_PUBLIC_APP_URL` gaat voor: de
 * Host-header van het verzoek is door een bezoeker te vervalsen, en een
 * herstel- of uitnodigingslink naar een vreemd domein is precies wat je niet
 * wil. Alleen als die variabele ontbreekt (typisch lokaal) vallen we terug op
 * de header.
 */
export async function absoluteUrl(path: string): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (configured) return `${configured}${path}`;

  const headerList = await headers();
  const host = headerList.get("host");
  if (!host) return `${getAppUrl()}${path}`;

  return `${headerList.get("x-forwarded-proto") ?? "http"}://${host}${path}`;
}
