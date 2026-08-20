/**
 * De downloadkant van een project: wat er uit de renderwachtrij komt en hoe het
 * bij de makelaar op de computer geraakt.
 *
 * Vier stukken, elk met één taak:
 *
 * - `results.ts`  van renderjobs naar kaarten op het scherm (puur rekenwerk)
 * - `access.ts`   rechten, project en jobs voor de downloadroutes
 * - `delivery.ts` van een opslag-URL naar bytes voor de browser
 * - `zip.ts`      alles samen in één archief, al schrijvend
 *
 * Alleen `results.ts` is bedoeld voor de browser; de rest raakt de opslag en
 * blijft dus op de server. Vandaar dat deze barrel enkel het pure stuk
 * doorgeeft — wie de andere nodig heeft, importeert ze rechtstreeks en ziet
 * meteen dat hij op de server zit.
 */

export {
  archiveFileName,
  buildExportResults,
  hasActiveExports,
  summariseExports,
} from "@/lib/exports/results";

export type {
  ExportMetadata,
  ExportOverview,
  ExportProjectContext,
  ExportResult,
} from "@/lib/exports/results";
