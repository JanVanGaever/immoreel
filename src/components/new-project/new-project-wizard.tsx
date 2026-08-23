"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Pencil, RotateCcw, Save } from "lucide-react";
import { StepAspectRatio } from "@/components/new-project/steps/step-aspect-ratio";
import { StepGoal } from "@/components/new-project/steps/step-goal";
import { StepName } from "@/components/new-project/steps/step-name";
import { StepPhotos } from "@/components/new-project/steps/step-photos";
import { StepReview } from "@/components/new-project/steps/step-review";
import { StepTemplate } from "@/components/new-project/steps/step-template";
import { useProjectDraft } from "@/components/new-project/use-project-draft";
import { Alert } from "@/components/ui/alert";
import { ErrorSummary } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { Steps } from "@/components/ui/steps";
import { API_ROUTES, DEFAULT_LOCALE, DEFAULT_TIMEZONE, ROUTES } from "@/lib/constants";
import { toAppError } from "@/lib/errors/normalize";
import { uploadFilesInBatch } from "@/lib/uploads/transport";
import { initialNewProjectState, type NewProjectActionState } from "@/lib/new-project/action-state";
import { createProjectAction } from "@/lib/new-project/actions";
import { buildNewProjectInput } from "@/lib/new-project/draft";
import { getGoal } from "@/lib/new-project/presets";
import {
  STEP_COUNT,
  WIZARD_STEPS,
  isLastStep,
  stepAt,
  stepIndex,
  type WizardStepId,
} from "@/lib/new-project/steps";
import {
  hasErrors,
  validateDraft,
  validateStep,
  type DraftErrors,
  type DraftField,
} from "@/lib/new-project/validation";
import type { Template } from "@/types";

/** Bij welke stap een veldfout hoort, zodat we daarheen kunnen springen. */
const FIELD_STEPS: Record<DraftField, WizardStepId> = {
  title: "naam",
  goal: "doel",
  aspectRatio: "formaat",
  templateId: "template",
  photos: "fotos",
};

/** Hoe een veld heet in de foutsamenvatting; `templateId` zegt de makelaar niets. */
const DRAFT_FIELD_LABELS: Record<DraftField, string> = {
  title: "Naam",
  goal: "Doel",
  aspectRatio: "Formaat",
  templateId: "Sjabloon",
  photos: "Foto's",
};

const indicatorSteps = WIZARD_STEPS.map(({ id, label }) => ({ id, label }));

/** "14:03" — genoeg om te zien hoe recent een concept is. */
function formatTime(value: string): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DEFAULT_TIMEZONE,
  }).format(new Date(value));
}

export type NewProjectWizardProps = {
  /** De templatecatalogus; de pagina haalt die uit de store. */
  templates: Template[];
};

/**
 * De wizard van concept naar project, in zes stappen.
 *
 * Alles gebeurt lokaal tot de laatste stap: geen serverrondje per stap, en een
 * concept dat een herlaadbeurt overleeft (zie `useProjectDraft`). Pas bij
 * "Openen in editor" gaat het naar `createProjectAction`, die opnieuw
 * valideert en het project aanmaakt.
 */
export function NewProjectWizard({ templates }: NewProjectWizardProps) {
  const router = useRouter();
  const controller = useProjectDraft(templates);
  const { draft } = controller;

  const [current, setCurrent] = useState(0);
  /** Pas na een poging tot verdergaan tonen we meldingen; niet tijdens het typen. */
  const [showErrors, setShowErrors] = useState(false);
  const [serverState, setServerState] = useState<NewProjectActionState>(initialNewProjectState);
  /** Percentage van de foto-upload, of `null` zolang die niet loopt. */
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const step = stepAt(current);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasMoved = useRef(false);

  // Afgeleid, niet bewaard: zo verdwijnt een melding zodra ze niet meer klopt,
  // zonder dat de gebruiker eerst opnieuw op "Volgende" moet duwen.
  const errors: DraftErrors = showErrors ? validateStep(step.id, draft, templates) : {};

  // Na een stapwissel de kop focussen: een schermlezer hoort zo waar hij staat.
  // De eerste ronde slaan we over, anders pakken we de autofocus van stap 1 af.
  useEffect(() => {
    if (!hasMoved.current) {
      hasMoved.current = true;
      return;
    }

    headingRef.current?.focus();
  }, [current]);

  function goTo(index: number) {
    setCurrent(Math.min(Math.max(index, 0), STEP_COUNT - 1));
    setShowErrors(false);
  }

  function jumpToFirstError(found: DraftErrors) {
    const field = (Object.keys(found) as DraftField[]).find((key) => found[key]);
    if (!field) return;

    setCurrent(stepIndex(FIELD_STEPS[field]));
    setShowErrors(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const found = validateStep(step.id, draft, templates);
    if (hasErrors(found)) {
      setShowErrors(true);
      if (isLastStep(current)) jumpToFirstError(found);
      return;
    }

    setShowErrors(false);

    if (!isLastStep(current)) {
      setCurrent(current + 1);
      return;
    }

    createProject();
  }

  /**
   * Van concept naar editor, in drie stappen die in deze volgorde moeten.
   *
   * 1. **Het project aanmaken.** Dat levert het id waar de foto's naartoe
   *    kunnen; eerder is er niets om ze aan te hangen.
   * 2. **De foto's uploaden.** Ze zitten tot hier alleen in dit tabblad
   *    (`controller.files()`), en een `File` overleeft geen navigatie. Wie hier
   *    eerst doorstuurt, laat ze achter. De tijdlijn ontstaat aan de serverkant
   *    uit deze upload — vandaar geen `?scenes=none`.
   * 3. **Pas dan naar de editor.**
   *
   * Loopt stap 2 mis, dan blijft de gebruiker hier staan met een melding en
   * zijn foto's nog in het scherm: opnieuw proberen kost hem dan één klik in
   * plaats van opnieuw twintig bestanden kiezen.
   */
  function createProject() {
    const input = buildNewProjectInput(draft);

    if (!input) {
      jumpToFirstError(validateDraft(draft, templates));
      return;
    }

    const files = controller.files();

    startTransition(async () => {
      setServerState(initialNewProjectState);
      setUploadProgress(null);

      const result = await createProjectAction(input);

      if (result.status === "fout") {
        setServerState(result);
        jumpToFirstError(result.fieldErrors ?? {});
        return;
      }

      if (result.status !== "gelukt") return;

      try {
        setUploadProgress(0);

        await uploadFilesInBatch({
          endpoint: API_ROUTES.projectAssets(result.projectId),
          files,
          onProgress: setUploadProgress,
        });
      } catch (cause) {
        // Het project bestaat nu wel en de foto's niet. De gebruiker mag niet
        // in een lege editor belanden zonder te weten waarom.
        const failure = toAppError(cause, { fallback: "upload-failed" });

        setServerState({
          status: "fout",
          message: `Het project is aangemaakt, maar de foto's raakten niet geüpload. ${failure.message}`,
        });
        setUploadProgress(null);

        return;
      }

      // Vanaf hier is alles binnen: het bewaarde concept mag weg.
      controller.forget();
      router.push(ROUTES.editor(result.projectId));
    });
  }

  function saveAndClose() {
    controller.saveNow();
    router.push(ROUTES.projects);
  }

  const { restorable } = controller;
  const savedLabel = controller.savedAt ? formatTime(controller.savedAt) : null;

  return (
    <div className="flex flex-col gap-4">
      {restorable ? (
        <Alert variant="info" title="Je hebt hier nog een concept staan">
          <p>
            {restorable.title || "Naamloos project"} — bijgewerkt om{" "}
            {formatTime(restorable.updatedAt)}.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={controller.restore}>
              Verder werken
            </Button>
            <Button variant="ghost" size="sm" onClick={controller.discardStored}>
              Weggooien
            </Button>
          </div>
        </Alert>
      ) : null}

      <Card>
        <div className="border-b border-border px-5 py-4">
          <Steps
            steps={indicatorSteps}
            current={current}
            onStepSelect={goTo}
            label="Stappen"
            className="hidden sm:block"
          />

          <div className="sm:hidden">
            <Meter
              value={current + 1}
              max={STEP_COUNT}
              label={`Stap ${current + 1} van ${STEP_COUNT}`}
              valueLabel={step.label}
              size="sm"
              srLabel="Voortgang in de wizard"
            />
          </div>
        </div>

        {/* Eén formulier over stap én knoppenrij: zo verstuurt Enter in een veld
            de stap, zonder extra toetsafhandeling. `key` per stap houdt elk
            scherm schoon, inclusief de autofocus. */}
        <form key={step.id} onSubmit={handleSubmit} noValidate>
          <div className="px-5 py-5">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-base font-semibold tracking-tight text-fg focus:outline-none"
            >
              {step.heading}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">{step.intro}</p>

            {/* De wizard springt al naar de stap van de eerste fout, maar de
                andere fouten staan dan op stappen die je niet ziet. Vandaar de
                volledige lijst hier: zonder dat lijkt de wizard klaar zodra dit
                ene veld goed staat. */}
            {serverState.status === "fout" ? (
              <ErrorSummary
                error={serverState.message}
                fields={serverState.fieldErrors}
                labels={DRAFT_FIELD_LABELS}
                className="mt-4"
              />
            ) : null}

            <div className="mt-5">
              {step.id === "naam" ? (
                <StepName title={draft.title} error={errors.title} onChange={controller.setTitle} />
              ) : null}

              {step.id === "doel" ? (
                <StepGoal goal={draft.goal} error={errors.goal} onSelect={controller.chooseGoal} />
              ) : null}

              {step.id === "formaat" ? (
                <StepAspectRatio
                  aspectRatio={draft.aspectRatio}
                  goal={draft.goal}
                  templates={templates}
                  error={errors.aspectRatio}
                  onSelect={controller.chooseAspectRatio}
                />
              ) : null}

              {step.id === "template" ? (
                <StepTemplate
                  templates={templates}
                  templateId={draft.templateId}
                  aspectRatio={draft.aspectRatio}
                  goal={draft.goal}
                  error={errors.templateId}
                  onSelect={controller.chooseTemplate}
                />
              ) : null}

              {step.id === "fotos" ? (
                <StepPhotos
                  photos={draft.photos}
                  recommendedPhotos={draft.goal ? getGoal(draft.goal).preset.recommendedPhotos : 10}
                  restoredPhotoCount={controller.restoredPhotoCount}
                  error={errors.photos}
                  onAdd={controller.addPhotos}
                  onRemove={controller.removePhoto}
                  onMove={controller.movePhoto}
                />
              ) : null}

              {step.id === "start" ? <StepReview draft={draft} templates={templates} /> : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => goTo(current - 1)} disabled={current === 0}>
                <ArrowLeft />
                Terug
              </Button>
              <Button variant="ghost" onClick={saveAndClose}>
                <Save />
                Bewaren en sluiten
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {/* Zodra de foto's de deur uit gaan, vervangt de balk het
                  bewaarlabel: het concept doet er dan niet meer toe, en een
                  upload van veertig foto's is te lang om alleen een draaiend
                  wieltje voor te tonen. */}
              {uploadProgress !== null ? (
                <Meter
                  className="hidden min-w-40 sm:block"
                  value={uploadProgress}
                  max={100}
                  size="sm"
                  label="Foto's uploaden"
                  valueLabel={`${Math.round(uploadProgress)} %`}
                  srLabel="Voortgang van de upload"
                />
              ) : savedLabel ? (
                <span className="hidden text-xs text-fg-subtle sm:inline">
                  Concept bewaard om {savedLabel}
                </span>
              ) : null}

              <Button
                type="submit"
                isLoading={isPending}
                loadingLabel={
                  uploadProgress === null ? "Project wordt aangemaakt" : "Foto's worden geüpload"
                }
                className="w-full sm:w-auto"
              >
                {isLastStep(current) ? (
                  <>
                    <Pencil />
                    Openen in editor
                  </>
                ) : (
                  <>
                    Volgende
                    <ArrowRight />
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
        <RotateCcw aria-hidden="true" className="size-3.5" />
        Je concept wordt automatisch bewaard in deze browser. De foto&apos;s zelf gaan pas mee zodra
        je het project aanmaakt.
      </p>
    </div>
  );
}
