/**
 * Gedeelde stijl voor alle formuliercontrols (input, textarea, select).
 * Eén plek voor hoogte, radius, rand en focus, zodat velden en knoppen
 * altijd op dezelfde lijn staan.
 */
export const controlBase =
  "w-full rounded-md border border-border bg-surface text-sm text-fg shadow-soft " +
  "transition-[border-color,box-shadow,opacity] duration-150 " +
  "placeholder:text-fg-subtle hover:border-border-strong " +
  "focus:border-brand focus:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60 " +
  "aria-[invalid=true]:border-danger";

export const controlSizes = {
  sm: "h-[var(--control-sm)] px-2.5 text-[0.8125rem]",
  md: "h-[var(--control-md)] px-3",
  lg: "h-[var(--control-lg)] px-3.5",
} as const;

export type ControlSize = keyof typeof controlSizes;
