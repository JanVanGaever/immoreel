# Workers

Renderen van video's duurt te lang voor een HTTP-request. Alles wat zwaar is
loopt daarom via een wachtrij en een los workerproces.

- `queue.ts` — het contract: jobnamen, payloads en de `JobQueue`-interface.
- `render-worker.ts` — de handlers per jobtype (nog leeg).

De handlers worden later gestart vanuit een eigen entrypoint (bv.
`node --experimental-strip-types src/workers/main.ts`) of vanuit een aparte
service. Ze horen bewust **niet** in de Next.js-serverbundel.
