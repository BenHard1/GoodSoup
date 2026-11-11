"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { createHousehold, joinHousehold } from "@/features/households/actions";
import { updateDisplayName } from "@/features/profile/actions";
import { initialActionState, type ActionState } from "@/lib/action-state";

function useGoOnSuccess(state: ActionState, href: string) {
  const router = useRouter();
  useEffect(() => {
    if (state.status === "success") router.push(href);
  }, [state, href, router]);
}

export function NameStep({ defaultName }: { defaultName: string }) {
  const [state, action] = useActionState(updateDisplayName, initialActionState);
  useGoOnSuccess(state, "/bienvenue?etape=foyer");
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <Field
        label="Prénom ou pseudonyme"
        hint="C'est ce que verront les membres de ton foyer."
        error={state.fieldErrors?.displayName}
      >
        {(p) => <Input {...p} name="displayName" defaultValue={defaultName} maxLength={60} required autoFocus />}
      </Field>
      <SubmitButton pendingLabel="Enregistrement…">Continuer</SubmitButton>
    </form>
  );
}

export function HouseholdStep({ defaultName }: { defaultName: string }) {
  const [createState, createAction] = useActionState(createHousehold, initialActionState);
  const [joinState, joinAction] = useActionState(joinHousehold, initialActionState);
  useGoOnSuccess(createState, "/bienvenue?etape=alimentation");
  useGoOnSuccess(joinState, "/bienvenue?etape=alimentation");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <h2 className="text-xl font-semibold">Créer mon foyer</h2>
        <p className="mt-1 text-sm text-ink-soft">Tu pourras ensuite inviter les personnes avec qui tu cuisines.</p>
        <form action={createAction} className="mt-4 flex flex-col gap-4">
          {createState.status === "error" && createState.message ? (
            <Alert tone="error">{createState.message}</Alert>
          ) : null}
          <Field label="Nom du foyer" error={createState.fieldErrors?.name}>
            {(p) => <Input {...p} name="name" defaultValue={defaultName} maxLength={60} required />}
          </Field>
          <SubmitButton pendingLabel="Création…">Créer</SubmitButton>
        </form>
      </Card>
      <Card>
        <h2 className="text-xl font-semibold">Rejoindre un foyer</h2>
        <p className="mt-1 text-sm text-ink-soft">Colle le lien d&apos;invitation qu&apos;on t&apos;a envoyé.</p>
        <form action={joinAction} className="mt-4 flex flex-col gap-4">
          {joinState.status === "error" && joinState.message ? <Alert tone="error">{joinState.message}</Alert> : null}
          <Field label="Lien d'invitation" error={joinState.fieldErrors?.invitation}>
            {(p) => <Input {...p} name="invitation" inputMode="url" autoComplete="off" required />}
          </Field>
          <SubmitButton variant="secondary" pendingLabel="Vérification…">
            Rejoindre
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
