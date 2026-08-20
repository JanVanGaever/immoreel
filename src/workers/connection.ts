import { Redis } from "ioredis";
import { getRedisUrl } from "@/workers/config";
import { createLogger } from "@/workers/logger";

/**
 * De verbindingen met Redis.
 *
 * BullMQ heeft er meer dan één nodig en ze mogen elkaar niet in de weg zitten:
 * een worker houdt een verbinding blokkerend open om op werk te wachten, en
 * over diezelfde verbinding kan de app dan geen job meer toevoegen. Daarom een
 * verbinding per rol, hier gemaakt en hier opgeruimd.
 *
 * `maxRetriesPerRequest: null` is geen voorkeur maar een eis van BullMQ voor de
 * blokkerende verbindingen: een commando dat na een paar pogingen opgeeft, laat
 * een worker stilvallen zonder dat iemand het merkt.
 */

export type ConnectionRole = "queue" | "worker" | "events";

const logger = createLogger("redis");

declare global {
  var __immoreelRedis: Map<ConnectionRole, Redis> | undefined;
}

function pool(): Map<ConnectionRole, Redis> {
  // Op de globalThis, anders maakt elke hot reload in ontwikkeling een nieuwe
  // verbinding en loopt Redis vol met clients die niemand meer aanspreekt.
  globalThis.__immoreelRedis ??= new Map();

  return globalThis.__immoreelRedis;
}

export function createRedisConnection(role: ConnectionRole): Redis {
  const connection = new Redis(getRedisUrl(), {
    // De wachtrij zelf mag falen; blokkerende verbindingen niet.
    maxRetriesPerRequest: role === "queue" ? 3 : null,
    // Verbinden gebeurt bij het eerste commando, niet bij het opstarten: zo
    // start de webserver ook als Redis er even niet is.
    lazyConnect: true,
    enableOfflineQueue: true,
  });

  connection.on("error", (error: unknown) => {
    // Geen throw: ioredis probeert zelf opnieuw. Wel loggen, want een
    // wachtrij die stil blijft is anders niet van een lege te onderscheiden.
    logger.error("Redis-verbinding gaf een fout", error, { role });
  });

  return connection;
}

/** Eén verbinding per rol, gedeeld binnen het proces. */
export function getRedisConnection(role: ConnectionRole): Redis {
  const existing = pool().get(role);
  if (existing) return existing;

  const connection = createRedisConnection(role);
  pool().set(role, connection);

  return connection;
}

/** Bij het afsluiten van een worker: netjes loskoppelen zodat Redis niets vasthoudt. */
export async function closeRedisConnections(): Promise<void> {
  const connections = [...pool().entries()];
  pool().clear();

  await Promise.all(
    connections.map(async ([role, connection]) => {
      try {
        await connection.quit();
      } catch (error) {
        logger.warn("Verbinding sloot niet netjes af", { role, error: String(error) });
        connection.disconnect();
      }
    }),
  );
}
