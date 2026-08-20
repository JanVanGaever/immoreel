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
| `npm run seed`      | Demodata nakijken en de renderbestanden klaarzetten |
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
│   │   ├── billing/            Abonnement, afrekenen, terugkeer van Mollie
│   │   └── settings/           Inclusief brand-kit, team en account
│   ├── (auth)/           Uitgelogde schermen: login, signup, wachtwoord, uitnodiging
│   ├── (editor)/         Editor met een eigen, schermvullende shell
│   ├── admin/            Intern supportpaneel, eigen shell, alleen lezen
│   └── api/              De HTTP-API (zie src/app/api/README.md)
├── components/
│   ├── account/          Tabbladen van "Mijn account": profiel, wachtwoord, voorkeuren
│   ├── admin/            Tabel, filterbalk, paginering en logs van het paneel
│   ├── auth/             AuthCard, PasswordInput
│   ├── billing/          Plannen, afrekenen, betaalgeschiedenis
│   ├── brand/            Huisstijlformulier en de preview van de eindkaart
│   ├── dashboard/        Kaarten en lijsten van het dashboard
│   ├── editor/           De editor: panelen, staat, preview, tijdlijn
│   ├── new-project/      De wizard: stappen, conceptstaat, keuzekaarten
│   ├── team/             Ledenlijst, rolbadges, uitnodigings- en rolvensters
│   ├── layout/           AppShell, Sidebar, Topbar, PageHeader, thema
│   └── ui/               Design system: Button, Card, Badge, Input, ...
├── db/                   Schema, databaseverbinding, de stores en `seed/`
├── lib/
│   ├── account/          Voorkeuren, verwijderregels, serveracties
│   ├── admin/            Toegang, filters, routes en de afgeleide logregels
│   ├── api/              Foutvorm, antwoordvorm, sessie en invoer van de routes
│   ├── auth/             Sessies, rollen, serveracties, validatie
│   ├── billing/          Plannen, btw, planwissels, serveracties
│   ├── brand/            Huisstijl: kleuren, lettertypes, samenvoegen
│   ├── mollie/           De koppeling met de betaalprovider
│   ├── editor/           Document, reducer, beweging, templates, export
│   ├── new-project/      Stappen, presets, validatie, concept, serveractie
│   ├── projects/         Projecten aanmaken, wijzigen, foto's, renders starten
│   ├── team/             Teamregels, uitnodigingen, serveracties
│   └── ...               cn(), constants, navigatie, formatters
├── styles/               tokens.css (waarden) + globals.css (Tailwind-koppeling)
├── types/                Domeintypes: pand, project, render, facturatie
├── workers/              Contract en handlers voor achtergrondjobs
└── proxy.ts              Route protection (de "middleware" van Next 16)
```

## Demodata

Na `npm run dev` is de app meteen te tonen: er staat een kantoor in met drie
mensen, drie panden, een huisstijl, drie renders en een half jaar
betaalgeschiedenis. Alles hangt aan elkaar — het project op het dashboard is
het project dat de editor opent, en de render eronder hoort bij datzelfde
project.

De dataset staat in [`src/db/seed/`](src/db/seed/) en nergens anders. Elke
store haalt daar zijn beginstand op; er is geen tweede plek waar demodata
ontstaat.

| Wat            | Hoeveel | Wat je ermee kunt                                        |
| -------------- | ------- | -------------------------------------------------------- |
| Organisatie    | 1       | Vastgoedkantoor Janssens (`org_demo`)                    |
| Gebruikers     | 3       | `owner`, `editor` en `viewer`, alle drie met wachtwoord  |
| Projecten      | 3       | Eén afgewerkt, één mislukt, één in bewerking             |
| Huisstijl      | 1       | Ingevuld contactblok, dus een eindkaart met inhoud       |
| Renderjobs     | 2 + 1   | Twee afgewerkte exports en één mislukte met herkansknop  |
| Facturatie     | 8 regels | Actief abonnement, met één mislukte incasso ertussen    |

### Wat het script doet

```bash
npm run seed
```

De data zelf zet de app klaar, niet dit script: ze leeft in het geheugen van de
server (zie [`src/db/README.md`](src/db/README.md)), en daar valt van buitenaf
niets in te schrijven. Het script doet de twee dingen die *wel* buiten dat
geheugen liggen:

- **Het kijkt de dataset na.** Projecten verwijzen naar de organisatie,
  renderjobs naar projecten en exportpresets, facturen naar het abonnement, en
  de wachtwoordhashes horen bij het wachtwoord hierboven. Wie een exportpreset
  hernoemt of een kleur in de huisstijl wijzigt, hoort dat hier te horen en
  niet pas in de app. `npm run seed -- --check` doet alleen dit, en faalt met
  code 1 — genoeg voor CI.
- **Het zet de renderbestanden klaar.** Voor elke afgewerkte render komt er een
  bestand in `RENDER_WORK_DIR/published/`, op de sleutel die de worker zou
  hebben gebruikt. Daardoor geeft de downloadknop echte bytes in plaats van een
  410. Het zijn plaatshouders en **geen speelbare video's**; een echte video
  maak je met de worker. Weghalen doe je met `npm run seed -- --clean`.

### De lege staat

Zet `IMMOREEL_SEED=off` in `.env.local` om te zien wat een nieuwe klant ziet:
een leeg dashboard, een lopende proefperiode en de standaardhuisstijl met een
leeg contactblok. Buiten development wordt er sowieso niets geseed.

### Twee dingen die de seed niet kan

- **Geen foto's.** De scènes hebben geen `assetId`, want er is nog geen object
  storage (zie de TODO in [`src/db/project-store.ts`](src/db/project-store.ts)).
  De editor toont daarvoor een grijs kader met de bestandsnaam. De bijschriften
  zijn er wél — die komen uit het project. Zelf foto's toevoegen kan wel:
  `POST /api/projects/:id/assets` schrijft ze naar `UPLOAD_DIR` en hangt er een
  scène aan.
- **Geen posterbeelden.** Een still hoort bij een video die echt gerenderd is.
  De kaarten op de downloadpagina vallen daarom terug op hun kleurvlak, precies
  zoals bedoeld voor renders zonder still.

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
| Uitnodiging        | `/invite`          | Account afwerken binnen een bestaand kantoor     |
| E-mail bevestigen  | `/email-change`    | Route handler: het nieuwe adres echt doorvoeren  |

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

In development staan er drie demoaccounts klaar, alle drie met hetzelfde
wachtwoord `Immoreel2026!`:

| Adres               | Rol      | Waarvoor                                    |
| ------------------- | -------- | ------------------------------------------- |
| `demo@immoreel.be`  | `owner`  | Alles, inclusief facturatie en teambeheer   |
| `sofie@immoreel.be` | `editor` | Projecten maken en monteren, geen facturatie |
| `karel@immoreel.be` | `viewer` | Alleen kijken                               |

Ze horen alle drie bij hetzelfde kantoor. Rollen controleer je door in te
loggen als die persoon, niet door naar een badge te kijken — zie
[Demodata](#demodata).

## Mijn account

`/settings/account` is het enige scherm in de app waar de rol niets uitmaakt:
een kijker beheert zijn account net zo goed als een eigenaar. Vier tabbladen,
in volgorde van risico — wat je dagelijks aanpast vooraan, wat onomkeerbaar is
achteraan.

| Tabblad         | Wat erin staat                                              |
| --------------- | ----------------------------------------------------------- |
| **Profiel**     | Je naam, je e-mailadres, en waar je bij hoort (kantoor + rol) |
| **Beveiliging** | Wachtwoord wijzigen — of voor het eerst instellen            |
| **Voorkeuren**  | Taal en waarover we je mogen mailen                          |
| **Account**     | Je account verwijderen                                       |

### Vier regels die de rest verklaren

- **Geen recht nodig, wel je wachtwoord.** Er staat geen `assertPermission()`
  boven deze acties: het is je eigen account. Wat er wél boven staat is
  `confirmPassword()` bij alles wat gevoelig is (ander e-mailadres, ander
  wachtwoord, verwijderen). Een openstaand tabblad op een gedeelde computer is
  genoeg om een sessie te hebben; het wachtwoord is wat een sessie niet
  bewijst. Wie via een magic link binnenkwam en er nog geen heeft, valt terug
  op de sessie — die kan niets bewijzen wat hij niet al kan.
- **Een e-mailadres wisselt in twee stappen.** De aanvraag verandert nog niets:
  er gaat een bevestigingslink naar het **nieuwe** adres en een waarschuwing
  naar het **oude**. Pas de klik op die link zet het adres om
  (`/email-change`). Het adres is immers ook de login: één typfout zou anders
  genoeg zijn om jezelf buiten te sluiten. Zolang de bevestiging uitblijft,
  staat op de kaart wat er te bevestigen valt, met "opnieuw versturen" en
  "intrekken" ernaast.
- **Verwijderen kan pas als het veilig kan.** `checkAccountDeletion()` in
  `src/lib/account/rules.ts` houdt twee dingen tegen, allebei dingen die je
  zelf kan oplossen: je bent de laatste eigenaar van een kantoor waar nog
  collega's in werken (maak eerst iemand anders eigenaar), of er loopt nog een
  abonnement terwijl je de laatste in het kantoor bent (zeg het eerst op, want
  het mandaat bij Mollie verdwijnt niet mee). De reden staat vóór de knop, niet
  ná de klik.
- **Bevestigen is overtypen.** Het venster vraagt je e-mailadres letterlijk
  over te typen, plus je wachtwoord. Niet om het moeilijk te maken maar om het
  traag te maken: een klik is zo gebeurd, een adres overtypen niet.

### Wat er vandaag nog niet gebeurt

Drie dingen die het scherm ook zelf zegt, zodat niemand zich rijk rekent:

- **De taalkeuze wordt bewaard, maar de schermen blijven Nederlands.** Er is
  nog geen vertaallaag in Immoreel. De keuze staat klaar voor de e-mails en de
  vertalingen die daarna komen.
- **De meldingen worden nog niet verstuurd.** Er hangt nog geen
  e-mailprovider aan; de schakelaars leggen vast wat er straks mag vertrekken.
  De catalogus staat in `src/lib/account/preferences.ts` — één plek, zodat er
  nooit een schakelaar op het scherm staat die de mailer niet kent.
- **Een wachtwoordwijziging sluit andere sessies niet af.** Het sessiecookie is
  een ondertekend token zonder tegenhanger in de databank; er is dus niets om
  in te trekken. Openstaande herstel- en inloglinks vervallen wél. Zodra
  sessies opgeslagen worden (samen met de ORM), hoort "log me overal uit"
  hierbij.

> Verwijderen wist de gebruiker, zijn lidmaatschappen, zijn tokens en zijn
> voorkeuren, en het kantoor als hij de laatste was. De projecten, renders,
> huisstijl en facturen van dat kantoor blijven voorlopig staan: hun stores
> kennen geen verwijderen. Met de databank hoort dat één `ON DELETE CASCADE`
> te zijn.

## Team

`/settings/team` is het scherm waar een kantoor zijn collega's beheert:
uitnodigen, rollen aanpassen en verwijderen. Iedereen mag kijken — weten wie
er meewerkt hoort bij het werk — maar alles wat iets verandert, vraagt
`members:manage` en dus de rol `owner`.

| Handeling            | Waar                                     | Recht             |
| -------------------- | ---------------------------------------- | ----------------- |
| Team bekijken        | `/settings/team`                         | ingelogd          |
| Uitnodigen           | Venster op de teampagina                 | `members:manage`  |
| Rol wijzigen         | Menu per rij                             | `members:manage`  |
| Verwijderen          | Menu per rij                             | `members:manage`  |
| Uitnodiging aanvaarden | `/invite?token=…` (uitgelogd bereikbaar) | de link zelf    |

### Vier regels die de rest verklaren

- **De UI is nooit het slot.** `src/lib/team/rules.ts` bevat pure functies —
  `checkRoleChange()`, `checkRemoval()`, `checkInvite()` — die zowel bepalen
  of een knop grijs staat als of de serveractie doorgaat. Elke actie in
  `src/lib/team/actions.ts` begint met `assertPermission("members:manage")` en
  draait daarna diezelfde controles opnieuw. Een uitgeschakelde knop is een
  suggestie; wat de server weigert, is de regel.
- **Twee vangnetten, ook voor een eigenaar.** Je eigen rol aanpassen of jezelf
  verwijderen kan niet (laat een andere eigenaar dat doen), en de laatste
  eigenaar kan niet verlaagd of verwijderd worden. Een kantoor zonder eigenaar
  kan niets meer: geen facturatie, geen team, geen organisatiegegevens.
- **Wat niet kan, staat er mét de reden bij.** De weigering uit `rules.ts` komt
  als tekst terug en verschijnt als tooltip op het uitgeschakelde menu-item of
  als uitleg onder de rol die niet gekozen kan worden — niet als foutmelding ná
  het klikken.
- **Een plaats is bezet zodra ze uitgenodigd is.** `PLAN_LIMITS[plan].seats`
  bepaalt hoeveel mensen er in een kantoor passen (`0` = onbeperkt), en een
  openstaande uitnodiging telt mee. Anders loopt een kantoor pas bij de vierde
  aanvaarding tegen de muur.

### De uitnodiging

Een uitnodiging is dezelfde soort als een herstellink: er wordt een token
gemaakt, alleen de SHA-256 ervan gaat naar de store, en de klare tekst zit
enkel in de link. Ze is **zeven dagen** geldig en werkt één keer — ruimer dan
een herstellink, want een collega op vakantie klikt niet meteen, maar niet
eindeloos.

- **Opnieuw versturen maakt een nieuwe link.** De oude hash wordt overschreven,
  dus de vorige mail werkt niet meer. Er is er altijd maar één geldig.
- **De link staat één keer op het scherm.** Meteen na uitnodigen, met een
  kopieerknop. Daarna is ze nergens meer op te vragen (we hebben alleen de
  hash) — kwijt is opnieuw versturen. Dat is geen noodoplossing voor de
  ontbrekende e-mailprovider alleen: een mail die in de spam belandt is de
  gewoonste zaak.
- **Een mislukte mail houdt de uitnodiging niet tegen.** Zolang
  `src/lib/auth/email.ts` geen provider heeft, gooit hij in productie; de actie
  vangt dat op en zegt eerlijk dat de link zelf doorgestuurd moet worden. In
  development staat de mail in de console.
- **Aanvaarden maakt het account af**: naam en wachtwoord, meer niet. Het
  e-mailadres ligt vast (het is het adres waar de uitnodiging heenging) en het
  kantoor ook. Wie op de link in zijn mailbox klikt, bewijst dat hij bij die
  mailbox kan — dezelfde maatstaf als bij een herstellink.

> **Eén kantoor per gebruiker.** `findMembershipByUser()` geeft één
> lidmaatschap terug, en daar hangt de hele sessie aan vast. Een adres dat al
> ergens lid is, kan dus niet uitgenodigd worden; de teampagina zegt dat
> meteen bij het uitnodigen. Een account **zonder** lidmaatschap — iemand die
> hier verwijderd werd — mag wel opnieuw uitgenodigd worden en krijgt zijn
> eigen account terug in plaats van een tweede op hetzelfde adres.

### Verwijderen

Het lidmaatschap verdwijnt, de gebruiker blijft. Dat is genoeg om iemand
buiten te houden: `getSession()` geeft zonder lidmaatschap geen sessie terug,
dus bij zijn volgende klik ligt de app eruit — ook als hij nu nog ingelogd is.
Rollen werken om dezelfde reden meteen door: het sessiecookie draagt alleen
een gebruikers-id, rol en organisatie komen bij elk verzoek uit de store.

> De uitnodigingen draaien voorlopig in het geheugen van het proces, net als de
> auth-store: na een herstart van de server zijn ze weg.

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

## Facturatie

Abonnementen lopen via **Mollie**. Elk kantoor begint met veertien dagen proef;
daarna kiest het een plan en betaalt het maandelijks. Alle prijzen staan
exclusief btw — een makelaarskantoor rekent die terug — met het bedrag inclusief
21 % er altijd naast, want dat is wat er van de rekening gaat.

De flow in vier stappen:

1. `/billing` toont de stand van het abonnement en de plannen.
2. `/billing/checkout?plan=…` laat de klant Bancontact of kaart kiezen en legt
   uit dat hij een doorlopende machtiging afgeeft.
3. Mollie krijgt een betaling met `sequenceType: "first"`. Die int de eerste
   maand én levert het mandaat op.
4. Zodra de webhook zegt dat er betaald is, maken we het abonnement bij Mollie
   aan. Vanaf dan int Mollie zelf, elke maand.

Drie dingen die de rest verklaren:

- **De webhook is niet te vertrouwen, en dat hoeft ook niet.** Mollie stuurt
  alleen `id=tr_…`, zonder handtekening. Dat id wordt uitsluitend gebruikt om de
  betaling *op te halen* met onze eigen sleutel; wat die aanroep teruggeeft is
  de waarheid. Zie
  [`src/app/api/billing/webhook/route.ts`](src/app/api/billing/webhook/route.ts).
- **Upgraden en downgraden zijn niet symmetrisch.** Upgraden gaat meteen in en
  kost een pro-rata bijbetaling op het bestaande mandaat, zonder betaalscherm;
  downgraden gaat in als de betaalde periode om is en kost nu niets. Die regels
  staan op één plek: [`src/lib/billing/changes.ts`](src/lib/billing/changes.ts).
- **De terugkeerpagina beslist niets.** Dat de klant terugkomt, betekent alleen
  dat het betaalscherm klaar is. `/billing/return` pollt tot Mollie uitsluitsel
  geeft en zegt "nog onderweg" als dat het eerlijke antwoord is — bij een
  SEPA-incasso kan dat dagen duren.

Bij ontwikkelen kan Mollie geen webhook naar `localhost` afleveren. De
terugkeerpagina valt dan terug op pollen, wat dezelfde verwerking draait; wil je
de webhook zelf uitproberen, zet dan een tunnel op en vul die in als
`NEXT_PUBLIC_APP_URL`. Zonder `MOLLIE_API_KEY` tonen de plannen wel, maar kan er
niets afgesloten worden — de schermen zeggen dat ook.

## HTTP-API

Alles wat de schermen doen, kan ook over HTTP: projecten aanmaken en wijzigen,
foto's uploaden en herschikken, instellingen bewaren, renders starten en volgen,
de resultaten downloaden, de huisstijl bijstellen en de facturatiestand opvragen.
Bedoeld voor een koppeling met het kantoorpakket, een script dat twintig panden
ineens klaarzet, of een tweede client.

De app zelf gebruikt die routes maar voor een deel — formulieren lopen via
server actions, omdat die meteen kunnen doorsturen — maar beide wegen komen uit
bij dezelfde functies in `src/lib/projects/` en `src/lib/brand/`. Er is dus geen
weg waarlangs de API iets toelaat wat het scherm tegenhoudt, of omgekeerd.

De endpoints, de foutvorm en de afspraken staan in
[`src/app/api/README.md`](src/app/api/README.md).

## Intern adminpaneel

`/admin` is het paneel waarmee support een melding kan uitzoeken zonder een
ontwikkelaar te storen: welke klant, welk project, welke render, welke fout.
Het hoort niet bij de app van de klant — het staat er alleen in dezelfde
codebase omdat het dezelfde data leest.

| Pagina                          | Waarvoor                                                        |
| ------------------------------- | --------------------------------------------------------------- |
| `/admin`                        | Cijfers, foutcodes en de laatste mislukte renders                |
| `/admin/users`                  | Gebruikers: zoeken op naam, e-mailadres of id                    |
| `/admin/organisations`          | Kantoren, met de kapotte bovenaan                                |
| `/admin/organisations/[id]`     | Eén kantoor: leden, projecten, renders, facturatie, tijdlijn     |
| `/admin/projects`               | Projecten over alle kantoren heen                                |
| `/admin/projects/[id]`          | Eén project: scènes, renders, tijdlijn, ruwe rij                 |
| `/admin/jobs`                   | Renderjobs, standaard gefilterd op **mislukt**                   |
| `/admin/jobs/[jobId]`           | Eén render: de fout, de stappen, de ids, de ruwe rij             |
| `/admin/billing`                | Abonnementen, mislukte incasso's, lopende afrekeningen           |
| `/admin/logs`                   | Alles op één tijdlijn, filterbaar op niveau en onderdeel         |

### Vier keuzes die de rest verklaren

- **Toegang is geen rol.** `owner`, `editor` en `viewer` gaan over wat een klant
  binnen zijn eigen kantoor mag; dit paneel kijkt over alle kantoren heen. De
  toegangslijst staat daarom in de omgeving: `ADMIN_EMAILS`, komma-gescheiden.
  Wie er niet op staat, krijgt een **404** en geen 403 — een paneel dat aan de
  buitenkant laat weten dat het bestaat, is een uitnodiging. In development
  staat `demo@immoreel.be` er standaard op; in productie betekent leeg niemand.
  Zie [`src/lib/admin/access.ts`](src/lib/admin/access.ts).
- **Het paneel leest, en meer niet.** Er is geen serveractie onder `/admin` en
  geen knop die iets wijzigt — ook niet onrechtstreeks: de store gebruikt
  bijvoorbeeld nooit `getSubscription()`, want dat *maakt* een proefperiode aan
  voor een kantoor dat er nog geen had. Een supportpaneel dat data verandert
  door ernaar te kijken, maakt van elk onderzoek een nieuw incident. Een
  kantoor zonder abonnementsrij ziet er dus uit als "geen rij", en dat is wat
  het is.
- **De filters staan in de URL.** De lijsten zijn servercomponenten met een
  gewoon GET-formulier erboven. Support plakt een link in een ticket en de
  collega die erop klikt, ziet exact dezelfde lijst.
- **De logs zijn afgeleid, niet verzameld.** Elke tijdstempel die de app
  bewaart, wordt één regel: job in wachtrij, job gestart, fout met code en stap,
  betaling mislukt, account nooit bevestigd. Dat is genoeg om te zien wat er
  gebeurde en het is eerlijk over wat het niet is — wat de renderworker naar
  stdout schrijft (`src/workers/logger.ts`) staat er niet in. Elke logregel
  draagt daarom haar `jobId` en foutcode voluit, zodat je ermee verder kunt in
  een logdienst. Zie [`src/lib/admin/events.ts`](src/lib/admin/events.ts).

### Waar de data vandaan komt

[`src/db/admin-store.ts`](src/db/admin-store.ts) is de poort. Ze bezit niets:
ze leest bij de auth-, project-, renderjob- en facturatiestore en legt naast
elkaar wat daar bewust gescheiden is. De vier stores kregen daarvoor elk een
paar leesmethodes die *wel* over organisaties heen kijken (`listAllUsers()`,
`listAllProjects()`, `listAll()`, `listAllSubscriptions()`). Ze staan in die
bestanden apart onder een kop, zodat bij een review meteen zichtbaar is wie ze
aanroept — overal elders begint een query bij een `organisationId`, en dat is
wat de ene klant van de andere gescheiden houdt.

Zoeken, filteren en bladeren zijn argumenten van die methodes en geen bewerking
achteraf. De in-memory versie filtert een array; de databankversie schrijft
daar een `WHERE` en een `LIMIT` van, zonder dat er één pagina verandert.

Omdat de stores in het geheugen van het proces draaien, toont het paneel wat
díé webserver ziet: projecten en renders verschijnen zodra iemand de wizard
afrondt en exporteert, en zijn na een herstart weer weg. De renders van een
losse worker zie je pas met `RENDER_WORKER_INLINE` (zie
[`src/workers/README.md`](src/workers/README.md)) of, straks, met een echte
databank.

### Wat er bewust niet in zit

Geen knop om een mislukte render opnieuw te starten, geen abonnement aanpassen,
geen account bewerken, en geen foto's of afgewerkte video's van klanten. Zodra
het paneel mag schrijven, hoort daar een audit-log bij die vastlegt wie wat
wijzigde — en die is er nog niet. Tot dan is "alleen lezen" geen beperking maar
de afspraak.

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
- **Nieuwe adminpagina**: route onder `src/app/admin/`, een regel in
  `src/lib/admin/routes.ts` (de navigatie volgt) en een leesmethode op
  `AdminStore` die haar filters als argument aanneemt. Gebruik `FilterBar`,
  `DataTable` en `Pagination` uit `src/components/admin`; de toegangscontrole
  zit al in `src/app/admin/layout.tsx`.
