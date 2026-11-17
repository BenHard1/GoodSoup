"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { saveFoodProfile } from "./actions";
import { ALLERGENS, ALLERGEN_VALUES, DIETS } from "./food-options";
import type { FoodProfile } from "./queries";

type Props = {
  householdId: string;
  profile?: FoodProfile | null;
  forSelf?: boolean;
  defaultName?: string;
  submitLabel?: string;
  onSaved?: () => void;
};

function Chip({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="relative inline-flex">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="flex min-h-11 cursor-pointer items-center rounded-full border border-line bg-white px-4 text-sm font-semibold peer-checked:border-ink peer-checked:bg-sage-soft peer-focus-visible:outline-3 peer-focus-visible:outline-ink">
        {label}
      </span>
    </label>
  );
}

export function FoodProfileForm({ householdId, profile, forSelf, defaultName, submitLabel = "Enregistrer" }: Props) {
  const [state, action] = useActionState(saveFoodProfile, initialActionState);
  const allergies = new Set(profile?.allergies ?? []);
  const otherAllergies = (profile?.allergies ?? []).filter((a) => !ALLERGEN_VALUES.includes(a));
  const diets = new Set(profile?.diets ?? []);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="householdId" value={householdId} />
      {profile ? <input type="hidden" name="profileId" value={profile.id} /> : null}
      {forSelf ? <input type="hidden" name="forSelf" value="1" /> : null}
      {forSelf ? (
        <input type="hidden" name="displayName" value={profile?.display_name ?? defaultName ?? "Moi"} />
      ) : (
        <Field label="Prénom" error={state.fieldErrors?.displayName}>
          {(p) => (
            <Input {...p} name="displayName" defaultValue={profile?.display_name ?? ""} maxLength={60} required />
          )}
        </Field>
      )}

      <fieldset>
        <legend className="text-sm font-semibold">Allergies et intolérances</legend>
        <p className="mt-1 text-sm text-ink-soft">
          Elles seront traitées comme des interdits stricts dans les suggestions. L&apos;application ne peut jamais
          garantir l&apos;absence d&apos;un allergène : vérifie toujours les étiquettes.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <Chip
              key={a.value}
              name="allergies"
              value={a.value}
              label={a.label}
              defaultChecked={allergies.has(a.value)}
            />
          ))}
        </div>
        <div className="mt-3">
          <Field label="Autres allergies" hint="Sépare-les par des virgules.">
            {(p) => <Input {...p} name="allergiesOther" defaultValue={otherAllergies.join(", ")} />}
          </Field>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Régimes alimentaires</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {DIETS.map((d) => (
            <Chip key={d.value} name="diets" value={d.value} label={d.label} defaultChecked={diets.has(d.value)} />
          ))}
        </div>
      </fieldset>

      <Field label="Aliments exclus" hint="Ce que tu ne manges jamais, séparé par des virgules.">
        {(p) => <Input {...p} name="exclusions" defaultValue={(profile?.exclusions ?? []).join(", ")} />}
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="J'adore" hint="Ex. : citron, coriandre, curry">
          {(p) => <Input {...p} name="likes" defaultValue={(profile?.likes ?? []).join(", ")} />}
        </Field>
        <Field label="Je n'aime pas" hint="Ex. : betterave, olives">
          {(p) => <Input {...p} name="dislikes" defaultValue={(profile?.dislikes ?? []).join(", ")} />}
        </Field>
      </div>
      <Field label="Objectifs (facultatif)" hint="Ex. : manger plus de légumes, plats rapides en semaine.">
        {(p) => <Textarea {...p} name="goals" maxLength={500} defaultValue={profile?.goals ?? ""} />}
      </Field>

      {state.message ? <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert> : null}
      <div>
        <SubmitButton pendingLabel="Enregistrement…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
