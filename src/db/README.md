# Data-laag

- `schema.ts` — tabelnamen en rijvormen, gekoppeld aan de types in `src/types`.
- `client.ts` — de verbinding; de rest van de app gebruikt alleen `getDb()`.
- `*-store.ts` — één poort per domein (auth, projecten, renders, facturatie …).
- `seed/` — de demodata van development, gedeeld door alle stores hierboven.

Er is nog geen ORM gekozen. Zolang dat zo is, gaat alles wat data leest of
schrijft via deze map, zodat de keuze later op één plek landt.

## De stores

Elke store is een `type` met methodes en daaronder een implementatie die alles
in het geheugen van het proces houdt. Dat geheugen overleeft een hot reload
(het hangt aan `globalThis`), maar niets meer dan dat: het is leeg na elke
herstart en wordt niet gedeeld tussen instanties. Webserver en renderworker
zien elkaars jobs dus alleen als ze hetzelfde proces delen — zie
`RENDER_WORKER_INLINE` in `src/workers/README.md`.

Een databank aansluiten is per store één nieuwe implementatie van dezelfde
interface, teruggegeven uit `getXStore()`. Geen enkele pagina verandert daarvan.

`project-asset-store.ts` is de enige zonder seed: foto's zijn bestanden, en een
rij die naar een bestand wijst dat er niet is, is erger dan geen rij. Ze
ontstaan alleen door te uploaden (`POST /api/projects/:id/assets`), en de
bestanden zelf gaan naar `UPLOAD_DIR` — zie `src/lib/uploads/storage.ts`.

## De seed

De beginstand van development staat in `seed/` en nergens anders. Elke store
haalt hem daar op bij zijn eerste aanroep:

```ts
function getData(): Map<ID, VideoProject> {
  globalThis.__immoreelProjects ??= seed(new Map());

  return globalThis.__immoreelProjects;
}
```

Dat is er niet altijd zo geweest, en het verschil is de moeite waard om te
onthouden: elke store had vroeger zijn eigen demodata. De dashboardstore toonde
zes projecten die in de projectstore niet bestonden, dus klikken op "Recente
projecten" gaf een 404. Eén dataset, gedeeld, maakt dat onmogelijk.

`isSeedEnabled()` beslist of er geseed wordt: nooit in productie, en lokaal niet
wanneer `IMMOREEL_SEED=off` staat. Wat erin zit en hoe je het nakijkt, staat in
de [Demodata-sectie van de README](../../README.md#demodata).

Twee regels voor wie de seed aanpast:

1. **Ids blijven vast.** `org_demo`, `prj_demo_leiestraat` — een demo die na
   elke herstart andere URL's heeft, is geen demo maar een zoektocht.
2. **Renderjob-ids worden berekend, niet verzonnen.** Ze komen uit het
   renderplan, net als bij een echte export (`src/lib/render/fingerprint.ts`).
   Daardoor vindt "opnieuw exporteren" de geseede render terug in plaats van er
   een tweede te maken. Wijzig je een project of de huisstijl, dan verschuiven
   die ids mee — dat hoort zo, en `npm run seed -- --check` kijkt na of alles
   nog naar elkaar verwijst.
