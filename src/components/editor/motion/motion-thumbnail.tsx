import { motionRectAt } from "@/lib/editor/motion";
import { cn } from "@/lib/utils";
import type { SceneMotion } from "@/types";

/**
 * Het traject van een beweging als tekeningetje: waar de camera begint
 * (streepjeslijn), waar ze eindigt (volle lijn) en de weg ertussen.
 *
 * Bewust stil. Deze thumbnail staat tien keer naast elkaar in het presetrooster
 * en op elke rij in de fotolijst; tien animaties tegelijk leiden af en zeggen
 * op dit formaat minder dan één duidelijke tekening. Bewegen doet de
 * mini-preview ernaast, met de foto zelf.
 *
 * De rechthoeken komen uit `motionRectAt()` — dezelfde uitsnede die `zoompan`
 * straks maakt. Bij een laag tempo raakt de eindrechthoek zichtbaar niet aan
 * het einde van haar traject, en dat klopt: een slow zoom komt niet aan.
 */

export type MotionThumbnailProps = {
  motion: SceneMotion;
  /** Beeldverhouding van de tekening; standaard liggend. */
  ratio?: number;
  className?: string;
};

const WIDTH = 48;

export function MotionThumbnail({ motion, ratio = 3 / 2, className }: MotionThumbnailProps) {
  const height = WIDTH / ratio;
  const from = motionRectAt(motion, 0);
  const to = motionRectAt(motion, 1);

  const box = (rect: typeof from) => ({
    x: rect.x * WIDTH,
    y: rect.y * height,
    width: rect.width * WIDTH,
    height: rect.height * height,
  });

  const start = box(from);
  const end = box(to);

  const startCenter = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
  const endCenter = { x: end.x + end.width / 2, y: end.y + end.height / 2 };
  const dx = endCenter.x - startCenter.x;
  const dy = endCenter.y - startCenter.y;
  const distance = Math.hypot(dx, dy);
  // Onder een halve pixel is er geen richting te tekenen: dat is een zuivere
  // zoom (of stilstand), en dan zeggen de twee kaders het al.
  const hasPath = distance > 0.5;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      aria-hidden="true"
      className={cn("h-auto w-full overflow-visible", className)}
    >
      <rect
        x={0.5}
        y={0.5}
        width={WIDTH - 1}
        height={height - 1}
        rx={2}
        className="fill-surface-inset stroke-border"
        strokeWidth={1}
      />

      <rect
        {...start}
        rx={1.5}
        fill="none"
        strokeDasharray="2 2"
        strokeWidth={1}
        className="stroke-fg-subtle"
      />

      {hasPath ? (
        <>
          <line
            x1={startCenter.x}
            y1={startCenter.y}
            x2={endCenter.x}
            y2={endCenter.y}
            strokeWidth={1}
            className="stroke-current opacity-70"
          />
          <polygon
            points={arrowHead(startCenter, endCenter)}
            className="fill-current"
          />
        </>
      ) : null}

      <rect {...end} rx={1.5} fill="none" strokeWidth={1.5} className="stroke-current" />
    </svg>
  );
}

/** Driehoekje op het eindpunt, gedraaid volgens de richting van de beweging. */
function arrowHead(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 3;
  const point = (offset: number, spread: number) => {
    const a = angle + offset;

    return `${(to.x + Math.cos(a) * spread).toFixed(2)},${(to.y + Math.sin(a) * spread).toFixed(2)}`;
  };

  return [point(0, 0), point(Math.PI * 0.8, size), point(-Math.PI * 0.8, size)].join(" ");
}
