# Workers

Renderen van een video duurt te lang voor een HTTP-request. Alles wat zwaar is
loopt daarom via een wachtrij (Redis + BullMQ) en een los workerproces.

```
editor ──exportProjectAction──► queue.ts ──Redis──► render-worker.ts
   ▲                               │                      │
   │                               │                      ├─► pipeline.ts ─► backend.ts (FFmpeg)
   │                               │                      │                  storage.ts
   └── /api/projects/:id/renders ◄─┴── render-job-store ◄──┘
       /api/.../renders/stream  ◄──── events.ts (voortgang uit Redis)
```

## Bestanden

- `config.ts` — alles wat uit de omgeving komt: Redis, concurrency, pogingen.
- `connection.ts` — de Redis-verbindingen, één per rol.
- `queue.ts` — jobs insturen. Hier zit de idempotentie.
- `events.ts` — meeluisteren met de voortgang; gebruikt door de SSE-route.
- `render-worker.ts` — de worker: claimen, uitvoeren, status bijwerken.
- `render/pipeline.ts` — de stappen van een render, los van FFmpeg.
- `render/backend.ts` — de poort naar FFmpeg (met een nepversie om op te draaien).
- `render/assets.ts` — waar de foto's vandaan komen.
- `render/storage.ts` — waar het resultaat heen gaat.
- `render/ffmpeg/` — de renderservice zelf; zie hieronder.
- `main.ts` — het entrypoint: `npm run worker`.

## De FFmpeg-service

```
render/ffmpeg/
├── config.ts    preset  -> resolutie, framerate, encoder (per platform)
├── filters.ts   motion  -> zoompan, overgang -> xfade, tekst -> drawtext
├── scene.ts     één foto -> één clip
├── cards.ts     intro- en contactkaart
├── audio.ts     muziek zoeken en eronder leggen
├── stitch.ts    clips -> één mp4 (+ posterframe)
└── run.ts       FFmpeg starten, volgen, afbreken
```

Een render gaat in twee slagen: eerst wordt elke foto een eigen clip
(schalen, bijsnijden, `zoompan`, coderen), daarna gaan die clips aan elkaar.
Dat is geen omweg. Eén filtergraaf met veertig `zoompan`-takken houdt veertig
gedecodeerde foto's tegelijk in het geheugen, is bij een fout onleesbaar, en
laat de voortgangsbalk raden.

Wat de video wordt, staat volledig in het renderplan
(`src/lib/editor/render-plan.ts`). Er wordt niets bijverzonnen en niets
gegenereerd: dezelfde foto's met dezelfde instellingen geven twee keer dezelfde
video.

### Beweging

De beweging zelf staat **niet** hier maar in `src/lib/editor/motion.ts` — exact
dezelfde module waarmee de preview in de browser tekent. `toZoompanFilter()`
zet begin- en eindkader plus versnellingscurve om in de `z`-, `x`- en
`y`-expressies van `zoompan`. Daardoor kan de render niet anders uitkomen dan
wat de makelaar zag: er is maar één plek waar de beweging bestaat.

`ZOOMPAN_MAPPING` in `filters.ts` beschrijft per bewegingssoort wat er gebeurt;
die tekst gaat ook mee in de logs van een render.

Vóór `zoompan` wordt de foto twee keer zo groot geschaald
(`RENDER_ZOOMPAN_SUPERSAMPLE`). `zoompan` legt zijn uitsnede namelijk op hele
pixels van het invoerbeeld; op uitvoerformaat verspringt een trage zoom
daardoor zichtbaar.

### Samenvoegen

| Overgangen in het plan | Wat er gebeurt                                    |
| ---------------------- | ------------------------------------------------- |
| alleen harde cuts      | concat-demuxer met `-c:v copy` — geen hercodering |
| één zachte of meer     | alle clips in één `xfade`-keten                   |

In het eerste geval krijgen de clips meteen de encoderinstellingen van het
platform, want het tussenbestand ís het eindbestand. In het tweede geval mogen
ze snel en ruim: er gaat toch nog een codering overheen.

### Per platform

`PLATFORM_ENCODING` in `config.ts` bevat per exportpreset alleen wat afwijkt
van `BASE_ENCODING` — WhatsApp op baseline profile voor oude toestellen,
Instagram en TikTok met keyframes op elke seconde. Een nieuw platform is dus
een preset in de editor plus, als het eigen eisen heeft, één regel daar.

Resolutie en framerate lopen door één functie (`resolveTarget()`), zodat de
scènes en het samenvoegen nooit op verschillende formaten kunnen uitkomen.
`RENDER_RESOLUTION=720p` of `RENDER_FPS=24` maakt van hetzelfde plan een
kleinere of tragere video zonder dat de beweging verandert — bruikbaar op een
testomgeving, maar niet in productie: de gebruiker krijgt dan een ander formaat
dan hij koos.

### Geluid, tekst en logo

Muziek komt uit `RENDER_AUDIO_DIR` op de naam van het nummer. Ontbreekt ze, dan
wordt er zonder geluid gerenderd en staat dat in de logs — een export laten
mislukken om een bestand dat de gebruiker nooit zelf gekozen heeft, helpt
niemand. Volume, fades en loopen komen uit de audio-instellingen van het
project.

De intro- en contactkaart zijn een vlak in de kleur van de huisstijl met
`drawtext` erop. De tekst gaat via een bestand (`textfile=`) en niet inline:
een naam als "Van 't Hof" zou een filterstring anders stukmaken. Zonder
`RENDER_FONT_PATH` blijven de kaarten leeg in plaats van dat de render breekt.

De rijen zelf staan in `src/db/render-job-store.ts`, de statussen en labels in
`src/lib/render/`.

## Statussen

`queued → processing → finalizing → done`, met `failed` als eindpunt en
`queued` als terugval wanneer er nog een poging volgt. `finalizing` is de fase
waarin het beeld klaar is en alleen het wegschrijven nog loopt.

De projectstatus (`wachtrij`, `renderen`, `klaar`, `mislukt`) volgt uit alle
jobs van dat project samen: één afgewerkte export maakt een project nog niet
klaar als de andere nog loopt.

## Idempotentie

Een job krijgt geen willekeurige id maar een afgeleide van project, preset en
renderplan. Twee keer dezelfde opdracht is dus letterlijk dezelfde job, en
BullMQ neemt een bestaande id niet opnieuw aan. Verder:

- de worker weigert werk waarvan de store zegt dat het `done` is;
- elke schrijfactie gaat door een lease, dus een oude poging die terugkomt
  schrijft niets meer stuk;
- de uitvoer krijgt een vaste sleutel, dus een nieuwe poging overschrijft in
  plaats van te dupliceren;
- de werkmap wordt bij het begin van elke poging leeggemaakt.

## Voortgang naar de frontend

Twee wegen, allebei uit dezelfde bron:

- `GET /api/projects/:projectId/renders` — pollen, geeft alle jobs van het
  project.
- `GET /api/projects/:projectId/renders/stream` — server-sent events; elk
  bericht is een volledige momentopname, dus een gemiste boodschap haalt
  zichzelf in. Geen websocket: het verkeer gaat maar één kant op.

## Draaien

```bash
docker run -p 6379:6379 redis:7-alpine
npm run worker
```

Zolang de stores in het geheugen draaien (er is nog geen ORM gekozen), ziet een
los workerproces de projecten van de app niet en mislukt elke render met
`project-missing`. Zet daarom bij het ontwikkelen `RENDER_WORKER_INLINE=1` in
`.env.local`: de worker draait dan mee in het proces van de webserver. Dat is
een tijdelijke steun, geen ontwerp — zodra de databank er staat, hoort de
worker ook lokaal in zijn eigen proces.

### Zelf draaien

```bash
RENDER_BACKEND=ffmpeg RENDER_ASSET_DIR=./foto-s RENDER_FONT_PATH=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf npm run worker
```

De foto's heten in die map naar hun asset-id (`ast_1.jpg`). Met
`RENDER_DRY_RUN=1` en `LOG_LEVEL=debug` logt de worker elk FFmpeg-commando
zonder het uit te voeren — de snelste manier om een filtergraaf te bekijken.

## Wat er nog niet is

- de foto's uit object storage in plaats van uit een map of achter een URL
  (`render/assets.ts` heeft er de poort al voor);
- de voice-over en het wegdraaien van de muziek eronder
  (`duckUnderVoiceover`): er is nog geen spoor om in te spreken;
- het prijsblok over de eerste scène; het plan draagt de prijs nog niet mee;
- een echt logobestand — nu zijn het de initialen van de brand kit als tekst;
- jobs voor media (transcoderen, thumbnails). Die krijgen straks een eigen
  wachtrij op ditzelfde patroon.
