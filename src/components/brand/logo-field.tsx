"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, FieldLabel } from "@/components/ui/field";
import { Meter } from "@/components/ui/meter";
import { UploadZone } from "@/components/upload/upload-zone";
import { LOGO_CONSTRAINTS } from "@/lib/brand/validation";
import { createFakeTransport, type UploadTransport } from "@/lib/uploads/transport";
import { rejectionReason, type UploadConstraints } from "@/lib/uploads/validation";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Het logo van het kantoor: één bestand, geen lijst.
 *
 * `useUploads` is hier bewust niet gebruikt — dat regelt een wachtrij, een
 * volgorde en bulkacties, en van die drie is er hier geen enkele. Wat wél
 * hetzelfde blijft is de sleepzone en de transportpoort: zodra er object
 * storage is, wisselt `createXhrTransport({ endpoint })` de nagebootste upload
 * om en verandert er aan dit component niets.
 *
 * Zolang de upload loopt is `value` nog de oude URL. Pas als het bestand
 * binnen is, verandert de huisstijl — anders zou de preview een logo tonen dat
 * nergens staat.
 */

export type LogoFieldProps = {
  /** URL van het logo in de opslag; `null` als er nog geen is. */
  value: string | null;
  fileName: string | null;
  onChange: (logo: { url: string; fileName: string } | null) => void;
  transport?: UploadTransport;
  constraints?: UploadConstraints;
  disabled?: boolean;
  className?: string;
};

type UploadState =
  | { status: "leeg" }
  | { status: "bezig"; fileName: string; progress: number }
  | { status: "fout"; message: string };

export function LogoField({
  value,
  fileName,
  onChange,
  transport,
  constraints = LOGO_CONSTRAINTS,
  disabled = false,
  className,
}: LogoFieldProps) {
  const [state, setState] = useState<UploadState>({ status: "leeg" });
  const abortRef = useRef<AbortController | null>(null);
  // Zonder transport draait de upload nagebootst, zodat het scherm nu al werkt
  // (zie `PhotoUploader`). Zodra de opslag er staat, geef je hier
  // `createXhrTransport({ endpoint })` mee.
  const fallbackTransport = useMemo(() => createFakeTransport(), []);
  const send = transport ?? fallbackTransport;

  // Een upload die nog loopt terwijl het scherm verdwijnt, hoeft niet af.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function upload(files: File[]) {
    // De sleepzone laat er meer dan één binnen; een kantoor heeft één logo.
    const file = files[0];
    if (!file || disabled) return;

    const reason = rejectionReason(file, constraints);
    if (reason) {
      setState({ status: "fout", message: reason });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "bezig", fileName: file.name, progress: 0 });

    // Het lokale voorbeeld is meteen zichtbaar; de opslag levert straks de
    // definitieve URL. Mislukt de upload, dan geven we de blob-URL weer vrij.
    const previewUrl = URL.createObjectURL(file);

    try {
      const result = await send({
        file,
        assetId: `logo_${Date.now().toString(36)}`,
        signal: controller.signal,
        onProgress: (progress) =>
          setState((current) =>
            current.status === "bezig" ? { ...current, progress } : current,
          ),
      });

      onChange({ url: result.url ?? previewUrl, fileName: file.name });
      setState({ status: "leeg" });
    } catch (error) {
      URL.revokeObjectURL(previewUrl);

      if (error instanceof DOMException && error.name === "AbortError") {
        setState({ status: "leeg" });
        return;
      }

      setState({
        status: "fout",
        message: error instanceof Error ? error.message : "De upload is mislukt.",
      });
    }
  }

  function remove() {
    abortRef.current?.abort();
    setState({ status: "leeg" });
    onChange(null);
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <FieldLabel>Logo</FieldLabel>

      {state.status === "bezig" ? (
        <div className="rounded-xl border border-border bg-surface-subtle px-4 py-3">
          <Meter
            value={state.progress}
            max={100}
            tone="brand"
            label={<span className="truncate">{state.fileName}</span>}
          />
        </div>
      ) : value ? (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-subtle p-3">
          {/* Een geruit vlak eronder: alleen zo zie je of het logo echt
              transparant is, en dat bepaalt of het over een foto kan liggen. */}
          <span className="surface-grid flex size-16 shrink-0 items-center justify-center rounded-lg border border-border bg-surface p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Je logo" className="max-h-full max-w-full object-contain" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{fileName ?? "Logo"}</p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              Staat op de eindkaart en, als het watermerk aanstaat, in de hoek van elke video.
            </p>
          </div>

          <Button variant="ghost" size="sm" disabled={disabled} onClick={remove}>
            <Trash2 />
            Verwijderen
          </Button>
        </div>
      ) : (
        <UploadZone
          onFiles={upload}
          constraints={constraints}
          disabled={disabled}
          icon={ImageUp}
          title="Sleep je logo hierheen"
          description={`${constraints.label}, tot ${formatBytes(constraints.maxBytes)}. Een PNG met transparante achtergrond werkt het best.`}
          buttonLabel="Logo kiezen"
        />
      )}

      {state.status === "fout" ? (
        <FieldError>{state.message}</FieldError>
      ) : value ? (
        <FieldHint>Vervang het logo door het te verwijderen en een nieuw bestand te kiezen.</FieldHint>
      ) : null}
    </div>
  );
}
