import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  SEED_PASSWORD,
  SEED_USERS,
  isSeedEnabled,
  seedBrandKit,
  seedInvoices,
  seedMemberships,
  seedOrganisation,
  seedProjects,
  seedRenderJobs,
  seedSubscription,
  seedUsers,
} from "@/db/seed";
import { verifyPassword } from "@/lib/auth/password";
import { findExportPreset } from "@/lib/editor/export-presets";
import { workDir } from "@/workers/config";
import type { RenderJob } from "@/types";

/**
 * De seed van buitenaf: controleren, klaarzetten, opruimen.
 *
 *   npm run seed             controleert de dataset en zet de renderbestanden klaar
 *   npm run seed -- --check  controleert alleen; faalt met code 1 (voor CI)
 *   npm run seed -- --clean  haalt de klaargezette renderbestanden weer weg
 *
 * Waarom dit script bestaat terwijl de app zichzelf al seedt: de data van
 * development leeft in het geheugen van de server (zie `src/db/README.md`), dus
 * van buitenaf valt daar niets in te schrijven. Wat wél buiten dat geheugen
 * ligt, is de opslag — en dat is precies wat hier gebeurt. Voor elke afgewerkte
 * render komt er een bestand op de plek waar de worker het zou hebben
 * neergezet, zodat de downloadknop in de app echte bytes teruggeeft in plaats
 * van een 410.
 *
 * De controle staat er voor de dag dat iemand een kleur in de huisstijl wijzigt
 * of een exportpreset hernoemt. De dataset verwijst naar zichzelf — projecten
 * naar de organisatie, renderjobs naar projecten en presets, facturen naar het
 * abonnement — en dit is wat zegt of dat nog klopt, vóór je het in de app moet
 * ontdekken.
 *
 * Zodra er een ORM staat, is dit ook de plek waar de dataset de databank in
 * gaat: dezelfde functies uit `src/db/seed/`, dan met inserts erachter.
 */

type Mode = "seed" | "check" | "clean";

const PLACEHOLDER = [
  "Immoreel — plaatshouder voor een afgewerkte render.",
  "",
  "Dit bestand is neergezet door `npm run seed` en is GEEN speelbare video.",
  "Het staat er zodat de downloadknop in development echte bytes teruggeeft;",
  "een echte render maak je met de worker (zie src/workers/README.md).",
  "",
].join("\n");

function parseMode(argv: string[]): Mode {
  if (argv.includes("--check")) return "check";
  if (argv.includes("--clean")) return "clean";

  return "seed";
}

/* -------------------------------------------------------------------------
 * Controleren
 * ---------------------------------------------------------------------- */

/**
 * Loopt de dataset na op verwijzingen die niet meer kloppen. Geeft de problemen
 * terug in plaats van te gooien: één run hoort ze allemaal te tonen, niet
 * alleen de eerste.
 */
async function check(): Promise<string[]> {
  const problems: string[] = [];
  const complain = (condition: boolean, message: string) => {
    if (!condition) problems.push(message);
  };

  const organisation = seedOrganisation();
  const users = seedUsers();
  const memberships = seedMemberships();
  const brandKit = seedBrandKit();
  const projects = seedProjects();
  const jobs = seedRenderJobs();
  const subscription = seedSubscription();
  const invoices = seedInvoices();

  // De aantallen die de seed belooft te leveren.
  complain(users.length === 3, `Verwacht 3 gebruikers, gevonden ${users.length}.`);
  complain(projects.length === 3, `Verwacht 3 projecten, gevonden ${projects.length}.`);
  complain(
    jobs.filter((job) => job.status === "done").length === 2,
    "Verwacht 2 geslaagde renderjobs.",
  );
  complain(
    jobs.filter((job) => job.status === "failed").length === 1,
    "Verwacht 1 mislukte renderjob.",
  );

  // De hashes staan hard in `accounts.ts` en horen bij één wachtwoord. Vervalt
  // die band, dan kan niemand nog inloggen op de demo.
  for (const user of SEED_USERS) {
    const ok = await verifyPassword(SEED_PASSWORD, user.passwordHash);
    complain(ok, `De hash van ${user.email} hoort niet bij het seedwachtwoord.`);
  }

  const userIds = new Set(users.map((user) => user.id));
  const owners = memberships.filter((membership) => membership.role === "owner");

  complain(owners.length === 1, `Verwacht precies 1 eigenaar, gevonden ${owners.length}.`);

  for (const membership of memberships) {
    complain(userIds.has(membership.userId), `Lidmaatschap zonder gebruiker: ${membership.id}.`);
    complain(
      membership.organisationId === organisation.id,
      `Lidmaatschap ${membership.id} hangt niet aan ${organisation.id}.`,
    );
  }

  complain(
    brandKit.organisationId === organisation.id,
    "De huisstijl hoort bij een andere organisatie.",
  );

  const projectIds = new Set(projects.map((project) => project.id));

  for (const project of projects) {
    complain(
      project.organisationId === organisation.id,
      `Project ${project.id} hangt niet aan ${organisation.id}.`,
    );
    complain(project.scenes.length > 0, `Project ${project.id} heeft geen scènes.`);
    complain(project.durationInSeconds > 0, `Project ${project.id} duurt 0 seconden.`);

    for (const presetId of project.exportPresetIds) {
      complain(
        findExportPreset(presetId) !== null,
        `Project ${project.id} kiest exportpreset ${presetId}, en die bestaat niet meer.`,
      );
    }
  }

  // Een renderjob hoort bij een bestaand project én bij een platform dat dat
  // project ook gekozen heeft — anders staat er op de downloadpagina een kaart
  // die er volgens de editor niet hoort te zijn.
  for (const job of jobs) {
    complain(projectIds.has(job.projectId), `Renderjob ${job.id} wijst naar een leeg project.`);

    const project = projects.find((entry) => entry.id === job.projectId);

    complain(
      project?.exportPresetIds.includes(job.presetId) ?? false,
      `Renderjob ${job.id} rendert ${job.presetId}, maar dat platform staat uit bij ${job.projectId}.`,
    );

    if (job.status === "done") {
      complain(Boolean(job.outputKey), `Afgewerkte job ${job.id} heeft geen opslagsleutel.`);
      complain(job.progress === 100, `Afgewerkte job ${job.id} staat niet op 100 %.`);
    }

    if (job.status === "failed") {
      complain(job.error !== null, `Mislukte job ${job.id} heeft geen fout.`);
    }
  }

  complain(
    subscription.organisationId === organisation.id,
    "Het abonnement hoort bij een andere organisatie.",
  );

  // Eén reeks factuurnummers, oplopend en zonder dubbels: dat nummer staat in
  // de boekhouding van de klant.
  const numbers = invoices.map((invoice) => invoice.number);

  complain(new Set(numbers).size === numbers.length, `Dubbel factuurnummer: ${numbers.join(", ")}.`);
  complain(
    numbers.every((number, index) => index === 0 || number > numbers[index - 1]!),
    `Factuurnummers lopen niet op: ${numbers.join(", ")}.`,
  );

  for (const invoice of invoices) {
    complain(
      invoice.amountInCents === invoice.subtotalInCents + invoice.vatInCents,
      `Factuur ${invoice.number} telt niet op.`,
    );
    complain(
      invoice.status !== "betaald" || Boolean(invoice.paidAt),
      `Factuur ${invoice.number} is betaald zonder betaaldatum.`,
    );
  }

  return problems;
}

/* -------------------------------------------------------------------------
 * De bestanden van een afgewerkte render
 * ---------------------------------------------------------------------- */

function publishedRoot(): string {
  return resolve(workDir(), "published");
}

function outputPaths(jobs: RenderJob[]): { job: RenderJob; path: string }[] {
  return jobs
    .filter((job): job is RenderJob & { outputKey: string } => Boolean(job.outputKey))
    .map((job) => ({ job, path: join(publishedRoot(), job.outputKey) }));
}

async function writePlaceholders(jobs: RenderJob[]): Promise<string[]> {
  const written: string[] = [];

  for (const { path } of outputPaths(jobs)) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, PLACEHOLDER, "utf8");
    written.push(path);
  }

  return written;
}

async function removePlaceholders(jobs: RenderJob[]): Promise<string[]> {
  const removed: string[] = [];

  for (const { path } of outputPaths(jobs)) {
    await rm(path, { force: true });
    removed.push(path);
  }

  return removed;
}

/* -------------------------------------------------------------------------
 * Het overzicht
 * ---------------------------------------------------------------------- */

function euro(cents: number): string {
  return `EUR ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function megabytes(bytes: number | null): string {
  return `${Math.round((bytes ?? 0) / 1024 / 1024)} MB`;
}

/** Wat er klaarstaat, in de volgorde waarin je het in de app tegenkomt. */
function summary(): string[] {
  const organisation = seedOrganisation();
  const brandKit = seedBrandKit();
  const projects = seedProjects();
  const jobs = seedRenderJobs();
  const subscription = seedSubscription();
  const invoices = seedInvoices();
  const lines: string[] = [];

  lines.push("");
  lines.push(`Kantoor     ${organisation.name}  (${organisation.id})`);
  lines.push(
    `Huisstijl   ${brandKit.primaryColor} / ${brandKit.secondaryColor} — ${brandKit.contact.agentName}`,
  );

  lines.push("");
  lines.push(`Aanmelden   wachtwoord voor alle drie: ${SEED_PASSWORD}`);

  for (const user of SEED_USERS) {
    lines.push(`            ${user.email.padEnd(20)} ${user.role.padEnd(7)} ${user.name}`);
  }

  lines.push("");
  lines.push("Projecten");

  for (const project of projects) {
    lines.push(
      `            ${project.id.padEnd(26)} ${project.status.padEnd(13)} ${String(project.scenes.length).padStart(2)} scènes · ${String(project.durationInSeconds).padStart(5)} s · ${project.title}`,
    );
  }

  lines.push("");
  lines.push("Renders");

  for (const job of jobs) {
    const detail = job.status === "done" ? megabytes(job.sizeInBytes) : (job.error?.code ?? "—");

    lines.push(
      `            ${job.id.padEnd(26)} ${job.status.padEnd(13)} ${job.presetId.padEnd(22)} ${detail}`,
    );
  }

  lines.push("");
  lines.push(
    `Facturatie  ${subscription.planId} · ${subscription.status} · ${subscription.paymentMethod} · ${invoices.length} betalingen`,
  );

  for (const invoice of invoices) {
    lines.push(
      `            ${invoice.number}  ${invoice.status.padEnd(8)} ${euro(invoice.amountInCents).padStart(12)}  ${invoice.description}`,
    );
  }

  return lines;
}

/* -------------------------------------------------------------------------
 * Uitvoeren
 * ---------------------------------------------------------------------- */

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const jobs = seedRenderJobs();

  if (mode === "clean") {
    const removed = await removePlaceholders(jobs);

    console.log(`Opgeruimd:  ${removed.length} renderbestand(en) uit ${publishedRoot()}.`);
    return;
  }

  const problems = await check();

  if (problems.length > 0) {
    console.error(`De seed klopt niet (${problems.length}):`);
    for (const problem of problems) console.error(`  - ${problem}`);

    process.exitCode = 1;
    return;
  }

  console.log("Nagekeken:  alle verwijzingen, factuurnummers en wachtwoorden kloppen.");

  if (mode === "check") return;

  const written = await writePlaceholders(jobs);

  console.log(`Klaargezet: ${written.length} renderbestand(en) in ${publishedRoot()}.`);
  console.log("            Plaatshouders, geen speelbare video — de downloadknop werkt ermee.");

  if (!isSeedEnabled()) {
    console.warn("Let op:     IMMOREEL_SEED=off, dus de app zelf zet deze data niet klaar.");
  }

  for (const line of summary()) console.log(line);

  console.log("");
  console.log("Start met `npm run dev` en meld je aan met een van de adressen hierboven.");
}

await main();
