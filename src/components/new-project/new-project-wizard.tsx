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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { Steps } from "@/components/ui/steps";
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, ROUTES } from "@/lib/constants";
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

  function createProject() {
    const input = buildNewProjectInput(draft);

    if (!input) {
      jumpToFirstError(validateDraft(draft, templates));
      return;
    }

    // Het concept wordt nu een project; loopt het aanmaken toch mis, dan
    // zetten we het bewaarde concept meteen terug.
    controller.forget();

    startTransition(async () => {
      const result = await createProjectAction(input);

      if (result?.status === "error") {
        setServerState(result);
        // Het concept staat weer alleen in de browser; meteen terugzetten.
        controller.saveNow();
        jumpToFirstError(result.fieldErrors ?? {});
      }
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

            {serverState.status === "error" && serverState.message ? (
              <Alert variant="danger" title={serverState.message} className="mt-4" />
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
              {savedLabel ? (
                <span className="hidden text-xs text-fg-subtle sm:inline">
                  Concept bewaard om {savedLabel}
                </span>
              ) : null}

              <Button
                type="submit"
                isLoading={isPending}
                loadingLabel="Project wordt aangemaakt"
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
