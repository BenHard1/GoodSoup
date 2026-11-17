"use client";

import { AlertDialog } from "radix-ui";
import { useActionState, type ReactNode } from "react";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { Alert } from "./alert";
import { Button } from "./button";
import { SubmitButton } from "./submit-button";

type Props = {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  hiddenFields?: Record<string, string>;
  children?: ReactNode;
};

/** Confirmation explicite avant une action sensible (quitter, retirer, supprimer). */
export function ConfirmDialog({ trigger, title, description, confirmLabel, action, hiddenFields, children }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card bg-white p-6 shadow-card">
          <AlertDialog.Title className="font-display text-xl font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-2 text-ink-soft">{description}</div>
          </AlertDialog.Description>
          <form action={formAction} className="mt-4 flex flex-col gap-4">
            {Object.entries(hiddenFields ?? {}).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            {children}
            {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button type="button" variant="secondary">
                  Annuler
                </Button>
              </AlertDialog.Cancel>
              <SubmitButton variant="danger">{confirmLabel}</SubmitButton>
            </div>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
