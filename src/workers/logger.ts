/**
 * De logger van de workers.
 *
 * Stond hier eerst helemaal uitgeschreven; sinds er één foutlaag is, staat hij
 * in `@/lib/errors/logger` en gebruikt de hele app dezelfde. Dat is de winst:
 * een renderfout in een worker en dezelfde fout in een route leveren nu een
 * logregel met dezelfde velden op — `errorCode`, `errorDomain`, `errorId` —
 * dus één zoekopdracht vindt allebei.
 *
 * Dit bestand blijft bestaan omdat elke worker het importeert en omdat
 * `createLogger("render")` hier hoort te beginnen, niet in een gedeelde map.
 */

export { createLogger } from "@/lib/errors/logger";
export type { LogFields, Logger } from "@/lib/errors/logger";
