import { ApiError, isApiError } from "@/lib/api/errors";
import { jsonError } from "@/lib/api/response";
import { createLogger } from "@/lib/errors/logger";
import { describeError } from "@/lib/errors/normalize";

const log = createLogger("api");

/**
 * De rand van elke route: hier worden fouten antwoorden.
 *
 * Bewust een functie *in* de handler en geen wrapper eromheen. Next leidt de
 * vorm van een route handler af uit zijn eigen typegeneratie, en een generieke
 * wrapper zet daar een laag tussen die bij elke Next-versie opnieuw moet
 * kloppen. Zo blijft de handtekening van de route letterlijk die van Next, en
 * doet deze functie alleen wat ze moet doen:
 *
 * ```ts
 * export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
 *   return handle(async () => {
 *     const session = await requireApiSession("project:view");
 *     ...
 *   });
 * }
 * ```
 *
 * Wat er met een fout gebeurt, hangt af van wie hem bedacht heeft:
 *
 * - Een **`ApiError`** is een gepland antwoord. Die gaat er in zijn eigen vorm
 *   uit. Alleen een serverfout (5xx) wordt gelogd — een 404 of een 400 is geen
 *   incident maar een antwoord, en duizend van die logregels per dag maken de
 *   ene die er wél toe doet onvindbaar.
 * - **Al de rest** is van ons. Die wordt een 500 met een nietszeggende zin,
 *   want in de oorspronkelijke melding staat soms een verbindingsstring of een
 *   pad. De details gaan naar de logs, met dezelfde `errorId` als die in het
 *   antwoord staat: wie belt met "ik kreeg foutcode K7QM", is daarmee in één
 *   zoekopdracht terug te vinden.
 */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (isApiError(error)) {
      if (error.status >= 500) log.error("route gaf een serverfout", error);

      return jsonError(error);
    }

    const failure = new ApiError(
      "server-error",
      "Er ging iets mis aan onze kant. Probeer het opnieuw.",
      { cause: error, detail: describeError(error) },
    );

    log.error("onverwachte fout in een route", failure);

    return jsonError(failure);
  }
}
