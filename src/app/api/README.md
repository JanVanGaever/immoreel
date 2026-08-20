# De HTTP-API

Alles wat de schermen doen, kan hier ook — voor een script, een koppeling met
het kantoorpakket of een tweede client. De app zelf gebruikt deze routes maar
voor een deel: formulieren lopen via server actions, omdat die meteen kunnen
doorsturen en de pagina kunnen verversen. Ze komen wel uit bij **dezelfde
functies** in `src/lib/projects/`, `src/lib/brand/` en `src/lib/billing/`, dus
de twee wegen kunnen niet uit elkaar lopen.

## Afspraken

**Sessie.** Dezelfde cookie als de app (`immoreel_session`). Geen sessie is een
`401`, geen rechten een `403` — nooit een redirect naar het inlogscherm, want
een `fetch` die dat volgt, krijgt een inlogpagina met code 200 terug.

**Rechten.** Per route hetzelfde recht als op het scherm (zie
`src/lib/auth/roles.ts`): `viewer` leest, `editor` maakt en bewerkt, `owner`
regelt huisstijl en facturatie.

**Organisatie.** Een id uit een URL zegt niets. Elk project, elke foto en elke
render wordt opgezocht binnen de organisatie van de sessie; wat van een ander
kantoor is, bestaat niet — een `404`, geen `403`, want dat zou bevestigen dat
het id klopt.

**Fouten.** Altijd dezelfde vorm:

```json
{
  "error": {
    "code": "invalid-input",
    "message": "Er ontbreekt nog iets. Kijk de gemarkeerde velden na.",
    "fields": { "title": "Deze naam is te kort." },
    "errorId": "K7QM"
  }
}
```

`code` is machinetaal, `message` is Nederlands en mag op het scherm, en `fields`
staat er alleen bij als de fout per veld te plaatsen is. Alle velden komen in
één antwoord: wie drie fouten maakt, krijgt er drie terug.

`errorId` is de verwijzing naar deze ene fout. Hij staat ook in de logregel
ervan, dus een melding als "ik kreeg K7QM" is met één zoekopdracht terug te
vinden — inclusief de technische oorzaak, die bewust níet in het antwoord staat.

De codes, de statussen en de vraag of opnieuw proberen zin heeft, komen uit één
catalogus (`src/lib/errors/catalogue.ts`) die de hele app gebruikt: een 503 hier
en een mislukte upload in de browser krijgen dus dezelfde behandeling en
dezelfde bewoording.

| `code`              | Status | Wanneer                                            |
| ------------------- | ------ | -------------------------------------------------- |
| `unauthenticated`   | 401    | Geen of verlopen sessie                            |
| `forbidden`         | 403    | Rol mag dit niet                                   |
| `not-found`         | 404    | Bestaat niet, of niet binnen dit kantoor           |
| `invalid-input`     | 400    | De aanvraag klopt niet                             |
| `unsupported-media` | 415    | Verkeerd `Content-Type`                            |
| `too-large`         | 413    | Bestand groter dan we aannemen                     |
| `conflict`          | 409    | Klopt niet met de stand van zaken                  |
| `unavailable`       | 503    | Wachtrij of opslag staat er niet                   |
| `server-error`      | 500    | Onverwacht; de details staan in de logs            |

**Geen cache.** Elk JSON-antwoord krijgt `Cache-Control: no-store`. Alles hangt
aan een sessie, en een antwoord in een gedeelde cache is het project van het ene
kantoor in het tabblad van het andere. De bestandsroutes wijken daarvan af: die
mogen `private` gecachet worden, want een afgewerkte render verandert niet meer.

## Endpoints

### Projecten

| Methode  | Pad                              | Recht            | Wat                                  |
| -------- | -------------------------------- | ---------------- | ------------------------------------ |
| `GET`    | `/api/projects`                  | `project:view`   | Alle projecten van het kantoor       |
| `POST`   | `/api/projects`                  | `project:create` | Nieuw project (wat de wizard oplevert) |
| `GET`    | `/api/projects/:id`              | `project:view`   | Eén project                          |
| `PATCH`  | `/api/projects/:id`              | `project:edit`   | Titel, tijdlijn en instellingen      |
| `PUT`    | `/api/projects/:id/settings`     | `project:edit`   | Alleen de instellingen van de video  |

`PATCH` is partieel: wat je meestuurt verandert, de rest blijft. `scenes` is de
uitzondering — die lijst is de hele tijdlijn. Instellingen van een scène die
blijft bestaan, gaan niet verloren: stuur je bij een scène alleen haar `id` mee,
dan blijven duur, beweging en bijschriften staan. Dat is wat een herschikking
tot een herschikking maakt en niet tot een reset.

Twee velden kan je niet zetten: `status` (die schrijft de renderworker) en
`durationInSeconds` (die volgt uit de tijdlijn en wordt hier opnieuw berekend,
inclusief intro, slotkaart en de overlap van de overgangen).

Onbekende exportpresets verdwijnen stil uit `exportPresetIds` — de catalogus in
code is de waarheid, en een project van vorig jaar mag daar niet op stuklopen.
Wat er écht bewaard is, staat in het antwoord.

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "content-type: application/json" -b "immoreel_session=$COOKIE" \
  -d '{"title":"Leiestraat 44","goal":"instagram","aspectRatio":"9:16",
       "templateId":"tpl_dynamisch",
       "photos":[{"fileName":"gevel.jpg","mimeType":"image/jpeg","sizeInBytes":120000}]}'
```

### Foto's

| Methode | Pad                                | Recht           | Wat                          |
| ------- | ---------------------------------- | --------------- | ---------------------------- |
| `GET`   | `/api/projects/:id/assets`         | `project:view`  | De foto's, op volgorde       |
| `POST`  | `/api/projects/:id/assets`         | `media:upload`  | Uploaden (multipart)         |
| `PUT`   | `/api/projects/:id/assets/order`   | `project:edit`  | De volgorde bewaren          |
| `GET`   | `/api/assets/:assetId`             | `project:view`  | Het bestand zelf             |

Uploaden gaat als `multipart/form-data`, met zoveel bestanden als je wil en
onder welke veldnaam dan ook. Elke foto die erdoor komt, krijgt meteen een scène
achteraan de tijdlijn. Wat geweigerd wordt — verkeerd formaat, te groot, meer
dan de veertig die in een pandvideo passen — komt terug in `rejected`, met de
reden erbij; één bestand dat niet mag, maakt de andere negentien niet stuk. Zit
er niets bruikbaars bij, dan is het een `400`.

De volgorde bewaren doe je met de volledige rij:

```json
{ "assetIds": ["ast_a1", "ast_b2", "ast_c3"] }
```

Geen `position`-paren en geen "verplaats deze naar plek 2": een volledige rij is
idempotent en kan niet half aankomen. Klopt ze niet meer met wat er in het
project staat, dan krijg je een `409` in plaats van een volgorde die niemand
bedoeld heeft. De scènes schuiven mee, mét hun instellingen.

### Renders

| Methode | Pad                                     | Recht          | Wat                          |
| ------- | --------------------------------------- | -------------- | ---------------------------- |
| `POST`  | `/api/projects/:id/renders`             | `project:edit` | Export starten (**202**)     |
| `GET`   | `/api/projects/:id/renders`             | `project:view` | De stand van alle renders    |
| `GET`   | `/api/projects/:id/renders/:jobId`      | `project:view` | De stand van één render      |
| `GET`   | `/api/projects/:id/renders/stream`      | `project:view` | Meekijken via server-sent events |

`POST` neemt werk aan en rendert niets: per gekozen platform gaat er één job in
de wachtrij. Twee keer versturen levert geen twee renders op — de id van een job
volgt uit project, preset en renderplan — dus een client die niet weet of zijn
verzoek aankwam, mag het gerust nog eens proberen.

Zonder `REDIS_URL` is er geen wachtrij en antwoordt deze route `503`.

### Downloads

| Methode | Pad                                              | Wat                                |
| ------- | ------------------------------------------------ | ---------------------------------- |
| `GET`   | `/api/projects/:id/exports`                      | Overzicht met downloadlinks (JSON) |
| `GET`   | `/api/projects/:id/exports/:jobId/download`      | Het bestand                        |
| `GET`   | `/api/projects/:id/exports/:jobId/poster`        | Het posterbeeld                    |
| `GET`   | `/api/projects/:id/exports/zip`                  | Alles in één archief               |

Het overzicht geeft per platform de laatste export, hoe ver ze staat, hoe ze
straks heet en waar ze te halen is. `downloadUrl` en `posterUrl` zijn `null`
zolang er niets achter zit: een knop die een `409` geeft, is een knop die er niet
had moeten staan.

De drie bestandsroutes geven bytes en géén JSON — ook niet bij een fout, want
een browser navigeert erheen. Ze bestonden al voor deze API en blijven zoals ze
zijn.

### Huisstijl en facturatie

| Methode | Pad                    | Recht                 | Wat                                |
| ------- | ---------------------- | --------------------- | ---------------------------------- |
| `GET`   | `/api/brand-kit`       | `project:view`        | De huisstijl van het kantoor       |
| `PUT`   | `/api/brand-kit`       | `organisation:manage` | Huisstijl wijzigen (partieel)      |
| `GET`   | `/api/billing/status`  | `project:view`        | Abonnement, plan en verbruik       |
| `GET`   | `/api/billing/payments/:paymentId` | `billing:manage` | De stand van één betaling |

Er is altijd een huisstijl: een kantoor dat nog nooit iets ingesteld heeft,
krijgt de standaardkit. Naast de kit komen er `warnings` mee — geen logo, twee
kleuren die op elkaar lijken — die het bewaren niet tegenhouden maar wel gezegd
mogen worden.

De facturatiestand beantwoordt drie vragen in één antwoord: wat loopt er, wat
kost het, en hoeveel is er al gebruikt. Wie ze uit drie endpoints moet rapen,
toont vroeg of laat een plan bij het verbruik van vorige maand. De ids van
Mollie zitten er niet in; de betaallink alleen voor wie de facturatie beheert.

### Meldingen

| Methode | Pad                        | Recht          | Wat                            |
| ------- | -------------------------- | -------------- | ------------------------------ |
| `GET`   | `/api/notifications`      | `project:view` | De meldingen van de ingelogde gebruiker |
| `POST`  | `/api/notifications/read` | `project:view` | Markeren als gelezen           |

Per gebruiker en niet per kantoor: een render hoort bij wie hem vroeg, een
rekening bij wie ze betaalt. `project:view` is dus geen echte drempel maar
alleen "ingelogd" — wie wat te zien krijgt, is beslist toen de melding gemaakt
werd (`src/lib/notifications/recipients.ts`).

De lijst staat nieuwste eerst en is afgetopt op vijftig. Het antwoord bevat de
teller `unread` erbij, zodat het bolletje op de bel niet uit een tweede
aanroep hoeft te komen.

`POST /read` neemt `{ "ids": [...] }` of `{ "all": true }` en antwoordt met de
nieuwe stand van de teller. De tweede vorm bestaat omdat "Alles gelezen"
anders een lijst zou moeten meesturen die intussen aangegroeid kan zijn.

Bij het opvragen worden de facturatieherinneringen uitgerekend — proefperiode
die afloopt, abonnement dat stopt. Dat is idempotent (zie `dedupeKey`), dus
pollen kost niets extra en er hoeft geen taak voor rond te lopen.

## Waar wat staat

```
src/lib/api/          Foutvorm, antwoordvorm, sessie en het uitpakken van verzoeken
src/lib/projects/     Wat een project doet: aanmaken, wijzigen, foto's, renders
src/lib/brand/        Huisstijl: lezen, valideren, bewaren
src/app/api/          De routes zelf — kort, want het werk staat hierboven
```

Een route doet vier dingen: sessie ophalen, verzoek uitpakken, een functie uit
`lib/` aanroepen, antwoorden. Alles wat daar niet in past, hoort in `lib/` thuis.

## Nog niet af

- **Geen paginering** op `GET /api/projects`. Bij een kantoor met tweehonderd
  panden hoort daar een `Paginated<T>` (zie `src/types/common.ts`).
- **Geen foto's verwijderen.** Uploaden en herschikken kan; weghalen doe je
  voorlopig door de scène uit de tijdlijn te halen. Het bestand blijft dan in de
  opslag staan.
- **Geen breedte en hoogte** bij een geüploade foto: daarvoor moet er
  beeldverwerking bij. `width`, `height` en `thumbnailUrl` blijven tot dan `null`.
- **Geen API-sleutels.** Alles loopt op de sessiecookie van een ingelogde
  gebruiker. Een koppeling die zonder mens moet draaien, heeft een token nodig
  dat aan de organisatie hangt in plaats van aan een persoon.
