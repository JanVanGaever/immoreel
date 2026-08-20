import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * De tabel van het paneel.
 *
 * Zes lijsten met dezelfde vorm: kolommen erin, rijen eruit. Eén component in
 * plaats van zes keer hetzelfde `<table>` betekent dat "een kolom rechts
 * uitlijnen" of "op mobiel horizontaal scrollen" één keer opgelost is en
 * overal klopt.
 */

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  /** Getallen rechts: zo staan de cijfers onder elkaar en zijn ze te vergelijken. */
  align?: "left" | "right";
  /** Kolommen die op een smal scherm mogen wegvallen. */
  className?: string;
  cell: (row: T) => ReactNode;
};

export type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  getKey: (row: T) => string;
  /** Wat er staat als er niets is. Een lege tabel zonder uitleg is een bug-melding. */
  empty: ReactNode;
  className?: string;
};

export function DataTable<T>({ rows, columns, getKey, empty, className }: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-12 text-center text-sm text-fg-muted">
        {empty}
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-surface", className)}>
      <table className="w-full min-w-max text-left text-sm">
        <thead className="border-b border-border bg-surface-subtle">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-2.5 text-xs font-medium tracking-wide text-fg-muted uppercase",
                  column.align === "right" && "text-right",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getKey(row)}
              className="border-b border-border last:border-0 hover:bg-surface-subtle/60"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-4 py-3 align-middle",
                    column.align === "right" && "text-right tabular-nums",
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Een id zoals support hem leest en doorgeeft: monospace, selecteerbaar, volledig. */
export function Identifier({ value, className }: { value: string; className?: string }) {
  return (
    <code
      className={cn("font-mono text-xs break-all text-fg-muted select-all", className)}
      title={value}
    >
      {value}
    </code>
  );
}

/** Twee regels in één cel: wat het is, en waar het bij hoort. */
export function CellStack({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-medium text-fg">{title}</div>
      {subtitle ? <div className="mt-0.5 truncate text-xs text-fg-subtle">{subtitle}</div> : null}
    </div>
  );
}
