"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { deleteAccount, updateDisplayName } from "./actions";

export function DisplayNameForm({ defaultName }: { defaultName: string }) {
  const [state, action] = useActionState(updateDisplayName, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Field label="Prénom ou pseudonyme" error={state.fieldErrors?.displayName}>
          {(p) => <Input {...p} name="displayName" defaultValue={defaultName} maxLength={60} required />}
        </Field>
      </div>
      <SubmitButton variant="secondary" pendingLabel="…">
        {state.status === "success" ? "Enregistré ✓" : "Enregistrer"}
      </SubmitButton>
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
    </form>
  );
}

export function DeleteAccountButton() {
  return (
    <ConfirmDialog
      trigger={<Button variant="danger">Supprimer mon compte</Button>}
      title="Supprimer définitivement ton compte ?"
      description={
        <p>
          Ton profil et tes données personnelles seront effacés. Si tu es seul(e) dans un foyer, il sera supprimé ;
          sinon, il reste aux autres membres. Cette action est irréversible.
        </p>
      }
      confirmLabel="Supprimer définitivement"
      action={deleteAccount}
    >
      <Field label="Tape SUPPRIMER pour confirmer">
        {(p) => <Input {...p} name="confirmation" autoComplete="off" required />}
      </Field>
    </ConfirmDialog>
  );
}
