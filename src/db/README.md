# Data-laag

- `schema.ts` — tabelnamen en rijvormen, gekoppeld aan de types in `src/types`.
- `client.ts` — de verbinding; de rest van de app gebruikt alleen `getDb()`.

Er is nog geen ORM gekozen. Zolang dat zo is, gaat alles wat data leest of
schrijft via deze map, zodat de keuze later op één plek landt.
