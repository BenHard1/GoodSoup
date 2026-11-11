"use client";

import { Check, Copy, Link2, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import {
  createHousehold,
  createInvitation,
  leaveHousehold,
  removeMember,
  renameHousehold,
  setActiveHousehold,
  type InvitationState,
} from "./actions";

export function InvitePanel({ householdId }: { householdId: string }) {
  const [state, action] = useActionState<InvitationState, FormData>(createInvitation, initialActionState);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <form action={action}>
        <input type="hidden" name="householdId" value={householdId} />
        <SubmitButton variant="secondary" pendingLabel="Création du lien…">
          <Link2 aria-hidden className="size-4" /> Créer un lien d&apos;invitation
        </SubmitButton>
      </form>
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {state.link ? (
        <div className="flex flex-col gap-2 rounded-xl border border-sage bg-sage-soft p-4">
          <p className="text-sm font-semibold">{state.message}</p>
          <p className="text-sm text-ink-soft">
            Valable 7 jours, 5 utilisations maximum. Envoie-le par SMS ou messagerie.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={state.link}
              aria-label="Lien d'invitation"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.link!);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
              {copied ? "Copié" : "Copier"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RenameHouseholdForm({ householdId, name }: { householdId: string; name: string }) {
  const [state, action] = useActionState(renameHousehold, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="householdId" value={householdId} />
      <div className="flex-1">
        <Field
          label="Nom du foyer"
          error={state.fieldErrors?.name ?? (state.status === "error" ? state.message : undefined)}
        >
          {(p) => <Input {...p} name="name" defaultValue={name} maxLength={60} required />}
        </Field>
      </div>
      <SubmitButton variant="secondary" pendingLabel="…">
        {state.status === "success" ? "Enregistré ✓" : "Renommer"}
      </SubmitButton>
    </form>
  );
}

export function RemoveMemberButton({
  householdId,
  userId,
  name,
}: {
  householdId: string;
  userId: string;
  name: string;
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm">
          Retirer
        </Button>
      }
      title={`Retirer ${name} du foyer ?`}
      description="Cette personne n'aura plus accès aux recettes et aux données du foyer. Tu pourras l'inviter à nouveau."
      confirmLabel="Retirer"
      action={removeMember}
      hiddenFields={{ householdId, userId }}
    />
  );
}

export function LeaveHouseholdButton({
  householdId,
  name,
  isLastMember,
}: {
  householdId: string;
  name: string;
  isLastMember: boolean;
}) {
  return (
    <ConfirmDialog
      trigger={<Button variant="secondary">Quitter ce foyer</Button>}
      title={`Quitter « ${name} » ?`}
      description={
        isLastMember
          ? "Tu es le dernier membre : le foyer et ses données partagées seront supprimés définitivement."
          : "Tu n'auras plus accès aux données partagées du foyer. Si tu es propriétaire, le rôle passera au membre le plus ancien."
      }
      confirmLabel="Quitter"
      action={leaveHousehold}
      hiddenFields={{ householdId }}
    />
  );
}

export function NewHouseholdForm() {
  const [state, action] = useActionState(createHousehold, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Field label="Nom du nouveau foyer" error={state.fieldErrors?.name}>
          {(p) => <Input {...p} name="name" maxLength={60} required />}
        </Field>
      </div>
      <SubmitButton variant="secondary" pendingLabel="Création…">
        <Plus aria-hidden className="size-4" /> Créer
      </SubmitButton>
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
    </form>
  );
}

export function SwitchHouseholdButton({ householdId }: { householdId: string }) {
  return (
    <form action={setActiveHousehold.bind(null, householdId)}>
      <Button type="submit" size="sm" variant="ghost">
        Utiliser ce foyer
      </Button>
    </form>
  );
}
