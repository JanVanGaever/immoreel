import { InputReader, handle, invalidInput, jsonOk, readJsonObject, requireApiSession } from "@/lib/api";
import { consumeAttempt } from "@/lib/auth/rate-limit";
import { importLogoWithFallback, LogoImportError } from "@/lib/brand/discover/logo";

/**
 * Het logo uit het voorstel overnemen.
 *
 * Apart van `POST /api/brand-kit/discover`, en dat is met opzet. Het voorstel
 * kijkt alleen: het haalt een pagina op en zegt wat het herkent. Dit schrijft
 * echt iets weg. Wie alleen wil kijken, hoort geen bestand in onze opslag te
 * zetten — en wie het logo niet aanvinkt, hoort er ook geen te krijgen.
 *
 * Het antwoord is dezelfde vorm als een geslaagde upload in het huisstijlveld:
 * een `url` en een `fileName`. Zo hoeft het formulier het onderscheid niet te
 * kennen tussen een logo dat iemand zelf koos en een dat we overnamen.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Strenger dan het voorstel zelf: hier komt er iets in de opslag terecht. */
const IMPORT_RATE_LIMIT = { limit: 10, windowSeconds: 60 * 60 };

export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireApiSession("organisation:manage");

    const reader = new InputReader(await readJsonObject(request));
    const url = reader.requiredText("url", { max: 500 });
    // Reserveadressen uit hetzelfde voorstel; het eerste dat een echte
    // afbeelding blijkt, wint.
    const alternatieven = reader.textList("alternatives", { max: 3 }) ?? [];
    reader.done();

    const rate = consumeAttempt(`logo:${session.organisation.id}`, IMPORT_RATE_LIMIT);

    if (!rate.allowed) {
      throw invalidInput("Te veel logo's achter elkaar opgehaald. Probeer het straks opnieuw.");
    }

    try {
      return jsonOk(await importLogoWithFallback([url, ...alternatieven], session.organisation.id));
    } catch (error) {
      // Een logo dat niet op te halen is, is geen storing van ons: de gebruiker
      // kan het gewoon zelf uploaden, en dat staat er ook bij.
      if (error instanceof LogoImportError) throw invalidInput(error.message);

      throw error;
    }
  });
}
