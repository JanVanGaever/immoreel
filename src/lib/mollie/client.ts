import { MOLLIE_API_BASE, getMollieApiKey } from "@/lib/mollie/config";

/**
 * De verbinding met Mollie.
 *
 * Bewust `fetch` en geen SDK. De koppeling gebruikt vijf endpoints; een
 * afhankelijkheid erbij zou vooral betekenen dat de foutafhandeling in een
 * vreemde vorm gegoten wordt, en juist die willen we hier zelf in de hand
 * hebben — dit is de enige plek in de app waar een fout geld kost.
 *
 * Alleen op de server. De API-sleutel geeft toegang tot alle betalingen van de
 * organisatie; die hoort nooit in een bundel voor de browser.
 */

export class MollieError extends Error {
  readonly status: number;
  /** Het veld waar Mollie over struikelt, als hij dat zegt. */
  readonly field: string | null;
  readonly detail: string;

  constructor(status: number, detail: string, field: string | null = null) {
    super(`Mollie ${status}: ${detail}`);
    this.name = "MollieError";
    this.status = status;
    this.detail = detail;
    this.field = field;
  }

  /**
   * Fouten waarbij het zin heeft het nog eens te proberen: Mollie ligt eruit
   * of knijpt af. Een 422 komt niet terug door te wachten.
   */
  get isTransient(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export type MollieRequestOptions = {
  /**
   * Maakt de aanroep herhaalbaar. Mollie onthoudt de sleutel 24 uur en geeft
   * bij een herhaling hetzelfde antwoord in plaats van een tweede betaling —
   * onmisbaar zodra er ergens opnieuw geprobeerd wordt.
   */
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export async function mollieRequest<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options: MollieRequestOptions = {},
): Promise<T> {
  const response = await fetch(`${MOLLIE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getMollieApiKey()}`,
      "Content-Type": "application/json",
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: options.signal,
    // Een betaalstatus uit een cache is geen betaalstatus.
    cache: "no-store",
  });

  const text = await response.text();
  const payload: unknown = text ? safeParse(text) : null;

  if (!response.ok) {
    throw toMollieError(response.status, payload, text);
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Mollie antwoordt op een fout met een JSON-body volgens `application/hal+json`:
 * `{ status, title, detail, field? }`. Ligt Mollie er zo grondig uit dat er
 * geen JSON komt, dan blijft de ruwe tekst over.
 */
function toMollieError(status: number, payload: unknown, raw: string): MollieError {
  if (payload && typeof payload === "object") {
    const { detail, title, field } = payload as Record<string, unknown>;

    return new MollieError(
      status,
      typeof detail === "string" ? detail : typeof title === "string" ? title : raw.slice(0, 200),
      typeof field === "string" ? field : null,
    );
  }

  return new MollieError(status, raw.slice(0, 200) || "Geen antwoord van Mollie.");
}
