import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DetailItem = {
  label: string;
  value: ReactNode;
  /** Ids, sleutels en hashes: monospace en volledig selecteerbaar. */
  mono?: boolean;
};

/**
 * De veldenlijst van een detailpagina.
 *
 * Altijd label boven waarde, altijd in dezelfde volgorde, en een streepje waar
 * niets staat. Een leeg veld weglaten scheelt ruimte en kost tijd: dan is niet
 * te zien of er niets ingevuld is of dat het veld niet bestaat, en dat is bij
 * een `mollieMandateId` precies het verschil tussen twee heel andere gesprekken.
 */
export function DetailList({ items, columns = 2 }: { items: DetailItem[]; columns?: 2 | 3 | 4 }) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-4 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "lg:grid-cols-4",
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs tracking-wide text-fg-subtle uppercase">{item.label}</dt>
          <dd
            className={cn(
              "mt-1 text-sm break-words text-fg",
              item.mono && "font-mono text-xs break-all select-all",
            )}
          >
            {item.value === null || item.value === undefined || item.value === "" ? (
              <span className="text-fg-subtle">—</span>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
