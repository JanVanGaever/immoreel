/**
 * Databaseverbinding.
 *
 * Nog geen ORM gekozen (Drizzle of Prisma). Dit bestand houdt de rest van de
 * app afgeschermd van die keuze: alleen `getDb()` en `isDatabaseConfigured()`
 * worden buiten deze map gebruikt.
 */

export type DatabaseClient = {
  readonly connectionString: string;
};

let client: DatabaseClient | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): DatabaseClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL ontbreekt. Zie .env.example.");
  }

  // TODO: vervang door de echte client zodra de ORM gekozen is.
  client ??= { connectionString };

  return client;
}
