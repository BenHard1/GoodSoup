"use client";

import { Check, Copy, Flag, Share2, Star } from "lucide-react";
import { Dialog } from "radix-ui";
import { useActionState, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { copyRecipe, rateRecipe, reportRecipe, saveRecipeNote } from "../actions";
import { REPORT_REASONS } from "../schemas";

export function CopyRecipeButton({
  recipeId,
  label = "Copier dans mes recettes",
}: {
  recipeId: string;
  label?: string;
}) {
  const [state, action] = useActionState(copyRecipe, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="recipeId" value={recipeId} />
      <SubmitButton variant="secondary" pendingLabel="Copie…">
        <Copy aria-hidden className="size-4" /> {label}
      </SubmitButton>
      {state.status === "error" ? <Alert tone="error">{state.message}</Alert> : null}
    </form>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        const url = window.location.href.split("?")[0];
        try {
          if (navigator.share) {
            await navigator.share({ title, url });
            return;
          }
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2500);
        } catch {
          // partage annulé
        }
      }}
    >
      {copied ? <Check aria-hidden className="size-4" /> : <Share2 aria-hidden className="size-4" />}
      <span aria-live="polite">{copied ? "Lien copié" : "Partager le lien"}</span>
    </Button>
  );
}

export function ReportDialog({ recipeId, alreadyReported }: { recipeId: string; alreadyReported: boolean }) {
  const [state, action] = useActionState(reportRecipe, initialActionState);
  // Après l'envoi, la page se met à jour (alreadyReported) : on garde la confirmation affichée.
  if (alreadyReported && state.status !== "success") {
    return <p className="text-sm text-ink-soft">Tu as signalé cette recette. Merci !</p>;
  }
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button type="button" variant="ghost" size="sm" className="w-fit text-ink-soft">
          <Flag aria-hidden className="size-4" /> Signaler
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card bg-white p-6 shadow-card">
          <Dialog.Title className="font-display text-xl font-semibold">Signaler cette recette</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-ink-soft">
            La modération examinera ton signalement. Ton nom n&apos;est pas communiqué à l&apos;auteur.
          </Dialog.Description>
          {state.status === "success" ? (
            <div className="mt-4 flex flex-col gap-4">
              <Alert tone="success">{state.message}</Alert>
              <Dialog.Close asChild>
                <Button type="button">Fermer</Button>
              </Dialog.Close>
            </div>
          ) : (
            <form action={action} className="mt-4 flex flex-col gap-4">
              <input type="hidden" name="recipeId" value={recipeId} />
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-semibold">Motif</legend>
                {REPORT_REASONS.map((r) => (
                  <label key={r.value} className="flex min-h-11 items-center gap-3">
                    <input type="radio" name="reason" value={r.value} required className="size-5 accent-coral-strong" />
                    {r.label}
                  </label>
                ))}
              </fieldset>
              <Field label="Précisions (facultatif)">
                {(p) => <Textarea {...p} name="details" maxLength={1000} rows={3} />}
              </Field>
              {state.status === "error" ? <Alert tone="error">{state.message}</Alert> : null}
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="secondary">
                    Annuler
                  </Button>
                </Dialog.Close>
                <SubmitButton>Envoyer</SubmitButton>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PersonalNote({ recipeId, note }: { recipeId: string; note: string | null }) {
  const [state, action] = useActionState(saveRecipeNote, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="recipeId" value={recipeId} />
      <Field
        label="Ma note personnelle"
        hint="Visible par toi seul (ex. « moins de sel la prochaine fois »)."
        error={state.fieldErrors?.body}
      >
        {(p) => <Textarea {...p} name="body" defaultValue={note ?? ""} maxLength={5000} rows={3} />}
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton variant="secondary" size="sm">
          Enregistrer la note
        </SubmitButton>
        {state.message ? (
          <span role="status" className={cn("text-sm", state.status === "error" ? "text-danger" : "text-ink-soft")}>
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function MyRating({ recipeId, rating }: { recipeId: string; rating: number | null }) {
  const [value, setValue] = useState(rating);
  const [pending, startTransition] = useTransition();
  return (
    <fieldset>
      <legend className="text-sm font-semibold">Mon avis</legend>
      <div className="mt-1 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
            aria-pressed={value === n}
            onClick={() => {
              const next = value === n ? null : n;
              setValue(next);
              startTransition(async () => {
                await rateRecipe(recipeId, next);
              });
            }}
            className="flex size-11 items-center justify-center rounded-full hover:bg-cream"
          >
            <Star
              aria-hidden
              className={cn("size-6", value && n <= value ? "fill-lemon text-ink" : "text-ink-faint")}
            />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
