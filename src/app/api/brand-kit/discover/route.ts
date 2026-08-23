import { InputReader, handle, invalidInput, jsonOk, readJsonObject, requireApiSession } from "@/lib/api";
import { consumeAttempt } from "@/lib/auth/rate-limit";
import { discoverBrandKit } from "@/lib/brand/discover";
import { UnreachableSiteError } from "@/lib/brand/discover/net";

/**
 * Een huisstijl voorstellen op basis van de website van het kantoor.
 *
 * Het antwoord is nadrukkelijk een **voorstel**: per veld een waarde, waar ze
 * vandaan komt en hoe zeker we zijn. Het scherm laat de gebruiker kiezen wat
 * hij overneemt; hier wordt niets bewaard. Wie het wil vastleggen, stuurt het
 * daarna als gewone `PUT /api/brand-kit`.
 *
 * `organisation:manage`, hetzelfde recht als voor het wijzigen van de kit: dit
 * is de eerste helft van diezelfde handeling.
 *
 * **Er zit een rem op, en die is niet cosmetisch.** Achter dit endpoint doet
 * onze server verzoeken naar een adres dat de gebruiker kiest. Zonder rem is
 * dat een gratis scanner op onze naam en ons IP-adres. De sleutel is de
 * organisatie en niet het IP: wie ingelogd is, is bekend.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tien sites per kwartier is ruim voor iemand die zijn huisstijl instelt. */
const DISCOVER_RATE_LIMIT = { limit: 10, windowSeconds: 15 * 60 };

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireApiSession("organisation:manage");

    const reader = new InputReader(await readJsonObject(request));
    const url = reader.requiredText("url", { max: 300 });
    reader.done();

    const rate = consumeAttempt(`discover:${session.organisation.id}`, DISCOVER_RATE_LIMIT);

    if (!rate.allowed) {
      throw invalidInput(
        `Te veel websites achter elkaar bekeken. Probeer het over ${Math.ceil(rate.retryAfterSeconds / 60)} minuten opnieuw.`,
      );
    }

    try {
      return jsonOk(await discoverBrandKit(url));
    } catch (error) {
      // Een site die niet bestaat of die we niet mogen benaderen, is geen fout
      // van ons: de gebruiker hoort te lezen wat er scheelt en een ander adres
      // te kunnen proberen. Vandaar een 400 met de zin erbij, en geen 502.
      if (error instanceof UnreachableSiteError) {
        throw invalidInput(error.message, { url: error.message });
      }

      throw error;
    }
  });
}
