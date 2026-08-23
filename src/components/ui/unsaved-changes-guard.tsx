"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/modal";

/**
 * Waarschuwt wanneer iemand wegklikt met werk dat nog niet bewaard is.
 *
 * Twee manieren om een pagina te verlaten, en ze vragen elk iets anders:
 *
 * - **Het tabblad sluiten of herladen.** Daar is `beforeunload` voor. De
 *   browser toont zijn eigen zin; die is niet aan te passen en dat hoort ook
 *   niet — een site die zelf mag schrijven wat er in dat venster staat, kan
 *   iemand een tabblad in praten.
 * - **Op een menu-item klikken.** Dat is het geval waar het echt misging, en
 *   `beforeunload` doet daar niets: Next navigeert binnen de pagina, de browser
 *   merkt er niets van. Vandaar dat we de klik zelf onderscheppen, vóór de
 *   router hem ziet.
 *
 * Bewust een eigen venster en geen `confirm()`. Die laatste is synchroon en
 * makkelijker, maar hij ziet eruit als een fout van de browser in plaats van
 * als een vraag van dit scherm — en op de vraag "wil je je huisstijl weggooien"
 * hoort een knop te staan die zegt wat er gebeurt.
 */

export type UnsavedChangesGuardProps = {
  /** Staat er werk klaar dat nog niet bewaard is? */
  when: boolean;
  title?: string;
  description?: string;
  /** Tekst op de knop die tóch wegnavigeert. */
  discardLabel?: string;
};

export function UnsavedChangesGuard({
  when,
  title = "Je wijzigingen zijn nog niet bewaard",
  description = "Ga je verder, dan gaan ze verloren.",
  discardLabel = "Verlaten zonder bewaren",
}: UnsavedChangesGuardProps) {
  const router = useRouter();
  // Waar de gebruiker heen wilde. `null` betekent: er staat geen vraag open.
  const [bestemming, setBestemming] = useState<string | null>(null);

  useEffect(() => {
    if (!when) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Ouder Safari en Firefox kijken naar `returnValue`; de tekst zelf wordt
      // door geen enkele browser meer getoond.
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);

  useEffect(() => {
    if (!when) return;

    function onClick(event: MouseEvent) {
      // Alleen een gewone linkerklik. Met ctrl, cmd of shift bedoelt iemand een
      // nieuw tabblad, en dan blijft deze pagina gewoon staan.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = (event.target as Element | null)?.closest?.("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || link.target === "_blank" || link.hasAttribute("download")) return;

      const doel = new URL(href, window.location.href);

      // Naar buiten gaan we niet tegenhouden: dat is een nieuw adres in dezelfde
      // tab, en `beforeunload` hierboven vangt dat al af.
      if (doel.origin !== window.location.origin) return;

      // Naar dezelfde pagina navigeren verandert niets en hoeft geen vraag.
      if (doel.pathname === window.location.pathname && doel.search === window.location.search) {
        return;
      }

      // Vóór de router: `capture` zorgt dat we hier eerder zijn dan Next.
      event.preventDefault();
      event.stopPropagation();
      setBestemming(doel.pathname + doel.search + doel.hash);
    }

    document.addEventListener("click", onClick, { capture: true });

    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [when]);

  const verlaten = useCallback(() => {
    const doel = bestemming;
    setBestemming(null);

    // De vraag is beantwoord; de volgende klik hoeft niet nog eens opgehouden te
    // worden. `when` staat op dat moment nog aan, dus we navigeren zelf.
    if (doel) router.push(doel);
  }, [bestemming, router]);

  return (
    <Modal open={bestemming !== null} onClose={() => setBestemming(null)} size="sm">
      <ModalHeader title={title} />
      <ModalBody>
        <p className="text-sm text-fg-muted">{description}</p>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={() => setBestemming(null)}>
          Hier blijven
        </Button>
        <Button variant="danger" onClick={verlaten}>
          {discardLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
