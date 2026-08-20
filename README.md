# Immoreel

SaaS voor Belgische vastgoedkantoren: van foto's van een pand naar een
afgewerkte vastgoedvideo.

De weg van foto naar video staat er: aanmelden, wizard, editor, wachtrij en de
FFmpeg-renderservice. Wat er nog **niet** is, is een databank — de stores
draaien in het geheugen van het proces — en object storage voor de foto's en de
afgewerkte video's.

## Starten

```bash
npm install
npm run dev
```

Kopieer `.env.example` naar `.env.local` en vul in wat je nodig hebt.

## Scripts

| Script              | Doel                                  |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Ontwikkelserver op http://localhost:3000 |
| `npm run build`     | Productiebuild                        |
| `npm run start`     | Productieserver                       |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | TypeScript zonder output              |

## Structuur

```
src/
├── app/                  Routes (App Router)
│   ├── (app)/            Ingelogde pagina's binnen de app-shell
│   │   ├── dashboard/
│   │   ├── projects/new/       Wizard voor een nieuw project
│   │   ├── projects/[projectId]/
│   │   ├── media/
│   │   ├── billing/
│   │   └── settings/
│   ├── (auth)/           Uitgelogde schermen: login, signup, wachtwoord
│   └── (editor)/         Editor met een eigen, schermvullende shell
├── components/
│   ├── auth/             AuthCard, PasswordInput
│   ├── dashboard/        Kaarten en lijsten van het dashboard
│   ├── editor/           De editor: panelen, staat, preview, tijdlijn
│   ├── new-project/      De wizard: stappen, conceptstaat, keuzekaarten
│   ├── layout/           AppShell, Sidebar, Topbar, PageHeader, thema
│   └── ui/               Design system: Button, Card, Badge, Input, ...
├── db/                   Schema, databaseverbinding en de stores
├── lib/
│   ├── auth/             Sessies, rollen, serveracties, validatie
│   ├── editor/           Document, reducer, beweging, templates, export
│   ├── new-project/      Stappen, presets, validatie, concept, serveractie
│   └── ...               cn(), constants, navigatie, formatters
├── styles/               tokens.css (waarden) + globals.css (Tailwind-koppeling)
├── types/                Domeintypes: pand, project, render, facturatie
├── workers/              Contract en handlers voor achtergrondjobs
└── proxy.ts              Route protection (de "middleware" van Next 16)
```

## Authenticatie

Elke gebruiker hoort bij één organisatie. Wie zich registreert, maakt meteen
zijn eigen organisatie aan en wordt daarvan **eigenaar**.

| Scherm             | Route              | Wat het doet                                     |
| ------------------ | ------------------ | ------------------------------------------------ |
| Inloggen           | `/login`           | Wachtwoord of magic link (twee tabs)             |
| Registreren        | `/signup`          | Account + organisatie in één keer                |
| Wachtwoord vergeten| `/forgot-password` | Stuurt een herstellink (1 uur geldig)            |
| Nieuw wachtwoord   | `/reset-password`  | Zet het wachtwoord en logt meteen in             |
| Magic link         | `/magic-link`      | Route handler: token inruilen voor een sessie    |

Uitloggen zit in het accountmenu rechtsboven.

### Hoe het in elkaar zit

- **Sessie**: een httpOnly-cookie met een HMAC-ondertekend token (payload +
  handtekening). Er staat alleen een gebruikers-id in; rol en organisatie
  worden bij elk verzoek opnieuw opgehaald, zodat een gewijzigde rol meteen
  doorwerkt.
- **Route protection**: `src/proxy.ts` controleert bij elk verzoek de
  handtekening en vervaldatum — snel en zonder databank. `requireSession()` in
  `src/app/(app)/layout.tsx` doet daarna de echte controle. Twee sloten op
  dezelfde deur: de proxy alleen is nooit genoeg.
- **Wachtwoorden**: scrypt uit `node:crypto`, met de parameters in de hash zelf.
  Geen extra dependency.
- **Formulieren**: server actions met `useActionState`. Validatie staat in
  `src/lib/auth/validation.ts` en draait altijd opnieuw op de server.
- **E-mail**: er is nog geen provider gekozen. In development schrijft
  `src/lib/auth/email.ts` de herstel- en inloglinks naar de console — zo zijn
  beide flows volledig te testen. In productie gooit die functie een fout tot
  je er een provider aan hangt.
- **Opslag**: `src/db/auth-store.ts` bevat de poort `AuthStore` en een
  in-memory implementatie. **Die is niet voor productie**: leeg na elke
  herstart en niet gedeeld tussen instanties. Zodra de ORM gekozen is, schrijf
  je één nieuwe implementatie van dezelfde interface.
- Ook `src/lib/auth/rate-limit.ts` (rem op inlogpogingen en herstelmails) zit
  in het geheugen van het proces en hoort naar Redis zodra er meer dan één
  instantie draait.

### Rollen

| Rol       | Mag                                                    |
| --------- | ------------------------------------------------------ |
| `owner`   | Alles: organisatie, facturatie, teamleden               |
| `editor`  | Projecten en media maken en bewerken                    |
| `viewer`  | Projecten en afgewerkte video's bekijken                |

De rangorde en de rechten staan in `src/lib/auth/roles.ts`. Gebruik
`can(role, "project:edit")` in de UI en `requirePermission()` of
`assertPermission()` op de server — nooit alleen de UI.

### Instellen

`AUTH_SECRET` in `.env.local` (minstens 32 tekens, per omgeving anders):

```bash
openssl rand -base64 48
```

Zonder die waarde draait development op een vaste ontwikkelsleutel; in
productie start de app niet zonder.

In development staat er één demoaccount klaar:
`demo@immoreel.be` / `Immoreel2026!`

## Nieuw project (wizard)

`/projects/new` maakt in zes stappen een videoproject: **naam → doel →
beeldverhouding → template → foto's → editor**. Alleen `owner` en `editor`
komen erin (`project:create`).

### Waarom het snel aanvoelt

- **Presets doen het werk.** Stap 2 (het doel: website, LinkedIn, Instagram,
  TikTok, WhatsApp) vult meteen de beeldverhouding, het template en de lengte
  van elke scène in. De twee stappen daarna zijn dus bevestigen in plaats van
  invullen. Wat je zelf kiest, wordt nooit meer door een preset overschreven —
  daarvoor dienen `choseAspectRatio` en `choseTemplate` op het concept.
- **Geen serverrondje per stap.** Alles gebeurt in de browser; pas
  "Openen in editor" praat met de server.
- **Enter werkt.** Elke stap is één `<form>`; Enter in een veld is hetzelfde
  als op "Volgende" duwen.
- **Alleen passende keuzes.** Stap 4 toont enkel templates die de gekozen
  verhouding aankunnen; wijzigt de verhouding, dan schuift de keuze mee.

### Concepten bewaren

Het concept gaat na elke wijziging naar `localStorage` (`draft-storage.ts`) en
wordt in de UI aangeboden om verder te werken — het komt nooit ongevraagd
terug, want de foto's blijven niet bewaard. Op `/projects` staat er een kaart
met "Verder werken" of "Verwijderen" zolang er een concept openstaat. Na het
aanmaken van het project wordt het concept opgeruimd.

Foto's leven tot de laatste stap als blob-URL's in de browser; ze gaan pas mee
zodra er object storage is. Wat er nu wél al klopt, is de vorm: elke foto wordt
één scène in de tijdlijn.

### Validatie

`lib/new-project/validation.ts` valideert per stap (`validateStep`) en in zijn
geheel (`validateDraft`). De wizard leidt de meldingen tijdens het renderen af,
zodat ze verdwijnen zodra het probleem opgelost is. De serveractie draait
diezelfde validatie opnieuw: naam (3–80 tekens), doel, verhouding, een template
dat bij die verhouding past, en 3 tot 40 foto's van maximaal 25 MB.

### Wat eruit komt

`createProjectAction` maakt via `ProjectStore` een `VideoProject` met status
`in-bewerking`, één scène per foto en een geschatte duur, en stuurt door naar
`/editor/{id}`. De editor leest datzelfde project weer uit de store.

> De projectstore draait voorlopig in het geheugen van het proces, net als de
> auth-store: na een herstart van de server is een aangemaakt project weg.

## Editor

`/editor/{projectId}` is het hart van de app: **foto's links, preview in het
midden, instellingen rechts**, met de tijdlijn onder de preview en bovenaan de
projectnaam, de bewaarstatus en het exporteren. Alleen `owner` en `editor`
komen erin (`project:edit`); op een smal scherm schakelt een balk onderaan
tussen de drie panelen in plaats van er twee te verbergen.

### Eén staat, één reducer

`lib/editor/state.ts` bevat de volledige staat als pure reducer: bewerken,
selecteren, sorteren en bulk aanpassen zijn allemaal acties. Twee dingen volgen
daaruit:

- **Autosave is triviaal.** Het document is één waarde; verandert die, dan moet
  er bewaard worden. Geen enkel paneel hoeft dat te melden.
- **Panelen blijven dom.** Ze tonen staat en sturen een actie. Een paneel
  toevoegen is dus één component, geen nieuwe staat die overal doorsijpelt.

De selectie hoort er bewust bij: bulk edit is één actie die op meerdere scènes
tegelijk werkt. Elke regelaar in het rechterpaneel doet daardoor automatisch aan
bulk edit zodra er iets aangevinkt staat (`targetSceneIds`).

### Wat er bewaard wordt

Het werkdocument (`lib/editor/document.ts`) is het project zonder wat de editor
niet mag wijzigen (id, organisatie, status) en mét wat alleen in de browser
bestaat: de bron van elke scène — de blob-URL en de voortgang van haar upload.
Bij het bewaren valt die bron weg, zodat er nooit een blob-URL naar de server
gaat.

`useAutosave` bewaart 900 ms nadat het wijzigen stopt, nooit twee keer tegelijk,
en vergelijkt wat er onderweg is met wat er nú in het scherm staat — "Bewaard"
staat er dus alleen als dat klopt. Mislukt het, dan blijft de wijziging als
niet-bewaard staan met een knop om opnieuw te proberen, en waarschuwt de browser
bij het sluiten van het tabblad. De serveractie `saveProjectAction` valideert
alles opnieuw: wat fout is wordt geweigerd, wat alleen buiten de grenzen valt
wordt rechtgetrokken (een scène van 400 seconden hoort geen autosave te laten
mislukken).

### Beweging per foto

Elke foto heeft haar eigen `SceneMotion`: **soort, sterkte, tempo, versnelling
en focuspunt**. De module staat in `lib/editor/motion.ts` (het rekenwerk) en
`components/editor/motion/` (de schermen), en werkt op losse waarden in plaats
van op de editorcontroller — dezelfde module past dus straks ook op een sjabloon
of in de mediabibliotheek.

**Tien presets, en daarna zelf afstellen.** Geen · zoom in · zoom uit · pan
links/rechts/omhoog/omlaag · Ken Burns · slow zoom · slow pan. Een preset is
niets meer dan een `SceneMotion` met een naam, dus na het kiezen blijft elke
waarde los bijstelbaar; wijkt de afstelling af, dan staat er "Aangepast" in
plaats van een preset die niet klopt. Slow zoom en slow pan zijn daarom geen
aparte soorten beweging maar een andere afstelling: een groot traject op een
laag tempo. De templates wijzen zelf ook presets aan (`presetMotion()`), zodat
er één woordenschat is in plaats van twee.

**Sterkte en tempo zijn niet hetzelfde.** Sterkte is hoe ver de camera zou
reizen (0 tot 1, maximaal 40 % vergroting). Tempo is hoeveel van die reis binnen
deze scène past: onder 1 maakt de beweging haar traject niet af — dat is wat een
slow zoom traag maakt — en boven 1 is ze vroeger klaar en staat het beeld daarna
stil. Beide regelaars zeggen in gewone taal wat ze doen, want in cijfers lijken
ze op elkaar.

**Zien wat je instelt.** Naast elke instelling loopt een mini-preview met de
foto zelf, en elke preset tekent haar eigen traject: waar de uitsnede begint
(streepjes), waar ze eindigt (volle lijn) en de weg ertussen. Diezelfde
tekening staat op elke rij in de fotolijst, zodat je van veertien foto's in één
blik ziet welke kant ze op bewegen. Wie `prefers-reduced-motion` aan heeft, ziet
een stilstaand eindbeeld met een knop om het één keer af te spelen.

**Waarom de preview klopt.** `motionFrames()` zegt waar de camera begint en
eindigt, `motionPhase()` wanneer ze onderweg is. Alles daarna leest die twee:

- `motionStyleAt()` — een CSS-transform voor de preview,
- `motionRectAt()` — de uitsnede voor de tekeningen,
- `toZoompanFilter()` — de FFmpeg-`zoompan`-expressie voor de render.

`transform-origin` in procenten schaalt rond precies het punt waar `zoompan`
zijn uitsnede legt, en de versnellingscurve staat in beide vormen (smoothstep in
JavaScript, dezelfde smoothstep als expressie). De filterstring staat per scène
onder "Renderinstructie" in het rechterpaneel — bij tempo 2 zie je er letterlijk
de `min(…,1)` in staan die het stilstaan aan het einde doet. Dat is niet ter
illustratie: `buildRenderPlan()` in `lib/editor/render-plan.ts` maakt er het
plan per foto van (frames, overgangen, filter) en de renderworker zet exact
diezelfde expressie op de opdrachtregel van FFmpeg. Als een instelling niet in
een filterstring te vatten is, is ze een knop zonder betekenis — dat is de test.

**Bewaard per foto.** De beweging hangt aan de scène, en een scène ís één foto;
`motionByAssetId()` geeft de configuratie op asset-id voor de pijplijn.
Alles komt binnen via `normaliseMotion()`, de enige plek waar een `SceneMotion`
ontstaat: die klemt elke waarde en leest ook oudere projecten (waarin de sterkte
nog "subtiel" of "sterk" heette).

De afspeelkop (`usePlayback`) woont in het middenpaneel en nergens anders: hij
beweegt zestig keer per seconde, en zo hertekenen links en rechts niet mee. Wie
aan de beweging van een foto zit, krijgt die scène meteen in een lus te zien
("Auto-preview").

### Foto's toevoegen

De uploadflow uit `components/upload` wordt hergebruikt. De koppeling loopt maar
één kant op: **een upload wordt een scène, nooit omgekeerd**. Verwijderen
gebeurt in de editor, die daarna de upload afbreekt — zonder die afspraak zouden
lijst en tijdlijn elkaar in een lus corrigeren. Verslepen verzet een index in de
lijst; de volgorde van de array ís de volgorde van de video.

Foto's uit de wizard hebben nog geen opslag en dus geen voorbeeld: die scènes
tonen een grijs kader met hun naam. Dat is zichtbaar in plaats van verstopt,
tot object storage er is.

### Panelen

| Paneel     | Wat erin staat                                                      |
| ---------- | ------------------------------------------------------------------- |
| Links      | Sleepzone, de foto's in volgorde, per foto duur en beweging, bulkbalk |
| Midden     | Preview, afspeelknoppen, tijdlijn met intro, scènes en slotkaart      |
| Rechts     | Tab **Scène**: duur, beweging, focuspunt, overgang, bijschriften      |
|            | Tab **Video**: beeldverhouding, template, huisstijl, muziek, export   |
| Boven      | Projectnaam (meteen bewerkbaar), status, bewaarstatus, exporteren     |

De catalogi staan los van de schermen: `templates.ts` (scènelengte, beweging,
overgang, intro/outro per template), `branding.ts` (huisstijlen en logopositie),
`audio.ts` (muziek, volume, fades) en `export-presets.ts` (formaat, resolutie,
bitrate en de grenzen van elk platform).

### Exporteren

De exportknop toont per platform het formaat en een schatting van de
bestandsgrootte, plus wat er misgaat: een afwijkende beeldverhouding is een
waarschuwing (er wordt bijgesneden), een lengte die het platform weigert houdt
de export tegen. `exportProjectAction` controleert rechten en presets opnieuw,
zet het project op `wachtrij` en stuurt één job per preset de wachtrij in.

> De editor mag geen beelden genereren. Hij configureert alleen: wat je instelt,
> is een instructie voor de renderpijplijn.

## Renderen

De export gaat via Redis en BullMQ naar een los workerproces, dat er met FFmpeg
een MP4 van maakt: per foto een `zoompan`-clip, daarna de clips aan elkaar met
de overgangen en de muziek eronder. De volledige uitleg — de opbouw van de
filters, de encoderinstellingen per platform, wat er per omgeving ingesteld moet
worden — staat in [`src/workers/README.md`](src/workers/README.md).

Twee dingen die de rest verklaren:

- **De beweging bestaat maar op één plek.** De worker gebruikt dezelfde
  `toZoompanFilter()` als de preview, dus wat de makelaar ziet, is wat er
  gerenderd wordt.
- **Er wordt niets gegenereerd.** De video is de geüploade foto's plus de
  ingestelde parameters, en niets anders. Dezelfde invoer geeft twee keer
  dezelfde video — daar hangt ook de idempotentie van de wachtrij aan vast.

Zonder `RENDER_BACKEND=ffmpeg` draait de nepbackend: die doorloopt de hele
pijplijn met voortgang en statussen, maar rendert niets. Zo is het scherm te
gebruiken zonder dat FFmpeg geïnstalleerd staat.

## Design system

Alle kleuren, radii en schaduwen staan als CSS-variabelen in
`src/styles/tokens.css` en worden in `src/styles/globals.css` aan
Tailwind-utilities gekoppeld. Componenten gebruiken uitsluitend die utilities
(`bg-surface`, `text-fg-muted`, `border-border`, `bg-brand`, `shadow-soft`),
nooit ruwe kleuren. Eén set tokens aanpassen verandert dus de hele app, licht
én donker.

Dark mode loopt via een `dark`-class op `<html>`, gezet door `ThemeScript`
(vóór de eerste paint) en `ThemeToggle`.

### Componenten

| Groep      | Componenten                                                        |
| ---------- | ------------------------------------------------------------------ |
| Acties     | `Button` (primary/secondary/ghost/danger, met `isLoading`), `IconButton`, `Spinner` |
| Formulier  | `FormField`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `ChoiceGroup`, `Switch` |
| Indeling   | `Form`, `FormSection`, `FormRow`, `FormActions`, `Card`, `Separator` |
| Navigatie  | `Tabs`, `DropdownMenu`, `Steps`                                     |
| Overlay    | `Modal` (+ `ModalHeader`, `ModalBody`, `ModalFooter`)               |
| Status     | `Badge`, `Stat`, `Skeleton`, `EmptyState`, `Avatar`                 |

Vaste maatvoering: controls gebruiken `--control-sm/md/lg` uit `tokens.css`, dus
een `Button` en een `Input` naast elkaar zijn altijd even hoog. Radius: `md` voor
controls, `xl` voor kaarten en modals, `full` voor badges en avatars.

Toegankelijkheid zit in de componenten: `FormField` koppelt label, hint en
foutmelding automatisch aan de control (`id`, `aria-describedby`,
`aria-invalid`), `Tabs` en `DropdownMenu` volgen het WAI-ARIA-toetsenbordpatroon
en `Modal` gebruikt het native `<dialog>` voor focus-trap en Escape.

## Zo breid je uit

- **Nieuwe pagina**: map onder `src/app/(app)/`, met `PageHeader` bovenaan. Ze
  is automatisch beschermd: alles buiten de routes in `PUBLIC_ROUTES` vereist
  een sessie.
- **Nieuw menu-item**: toevoegen in `src/lib/navigation.ts`; sidebar volgt.
- **Nieuw UI-component**: in `src/components/ui/`, exporteren via de barrel.
- **Nieuw domeintype**: in `src/types/`, daarna in `src/db/schema.ts` koppelen.
- **Nieuwe wizardstap**: toevoegen in `src/lib/new-project/steps.ts`, een
  scherm in `src/components/new-project/steps/` en de regels in
  `validation.ts`. De voortgangsindicator en de knoppen volgen vanzelf.
- **Nieuw doel of preset**: `src/lib/new-project/presets.ts`; een nieuw
  template komt in `src/db/template-store.ts` en krijgt zijn editorgedrag in
  `src/lib/editor/templates.ts`.
- **Nieuw paneel in de editor**: component in `src/components/editor/panels/`,
  de bijbehorende actie in `src/lib/editor/state.ts` en een `PanelSection` in
  `settings-panel.tsx`. Autosave volgt vanzelf.
- **Nieuwe beweging**: een soort erbij in `MOTION_OPTIONS` + `motionFrames()`
  (beide in `src/lib/editor/motion.ts`, mét haar `zoompan`-vertaling), of enkel
  een nieuwe afstelling in `MOTION_PRESETS`. Een exportpreset komt in
  `src/lib/editor/export-presets.ts`.
