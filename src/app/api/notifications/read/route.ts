import { getNotificationStore } from "@/db/notification-store";
import { InputReader, handle, jsonOk, readJsonObject, requireApiSession } from "@/lib/api";

/**
 * Meldingen als gelezen markeren.
 *
 * Twee vormen, en beide zijn nodig: `{ "ids": [...] }` voor wie er één opent,
 * `{ "all": true }` voor de knop "Alles gelezen". Zonder de tweede zou die knop
 * de hele lijst als lichaam moeten meesturen om vervolgens hetzelfde te doen —
 * en dan doet een lijst die intussen aangegroeid is, het niet meer.
 *
 * Het antwoord is de nieuwe stand van de teller. De bel hoeft daardoor niets
 * zelf af te trekken; wat hij toont, komt altijd van de server.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const session = await requireApiSession("project:view");

    const reader = new InputReader(await readJsonObject(request));
    const all = reader.boolean("all");
    const ids = reader.textList("ids", { max: 200 });
    reader.done();

    const store = getNotificationStore();

    // Een verzoek zonder allebei is geen fout: er valt dan gewoon niets te
    // markeren, en het antwoord is nog altijd de stand van de teller.
    if (all) await store.markAllRead(session.user.id);
    else if (ids && ids.length > 0) await store.markRead(session.user.id, ids);

    return jsonOk({ unread: await store.countUnread(session.user.id) });
  });
}
