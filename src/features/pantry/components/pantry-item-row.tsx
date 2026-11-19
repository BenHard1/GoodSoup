"use client";

import { Pencil } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { deletePantryItem, updatePantryItem } from "../actions";
import type { PantryItem } from "../queries";
import { PantryFields, type PantryFieldValues } from "./pantry-fields";

const toValues = (item: PantryItem): PantryFieldValues => ({
  name: item.name,
  brand: item.brand ?? "",
  quantity: item.quantity ?? "",
  location: item.location,
  expiresOn: item.expires_on ?? "",
  barcode: item.barcode ?? "",
});

/** Ligne du frigo : description (children), boutons modifier (formulaire déplié) et retirer. */
export function PantryItemRow({ item, children }: { item: PantryItem; children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(() => toValues(item));
  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await updatePantryItem(prev, formData);
    if (result.status === "success") setEditing(false);
    return result;
  }, initialActionState);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-expanded={editing}
            onClick={() => {
              setValues(toValues(item));
              setEditing((v) => !v);
            }}
          >
            <Pencil aria-hidden className="size-4" /> {editing ? "Fermer" : "Modifier"}
            <span className="sr-only"> {item.name}</span>
          </Button>
          <form action={deletePantryItem}>
            <input type="hidden" name="itemId" value={item.id} />
            <SubmitButton size="sm" variant="secondary" pendingLabel="…">
              Retirer<span className="sr-only"> {item.name}</span>
            </SubmitButton>
          </form>
        </div>
      </div>
      {editing ? (
        <form action={action} className="flex flex-col gap-3 rounded-xl bg-cream p-4">
          <input type="hidden" name="itemId" value={item.id} />
          <PantryFields values={values} onChange={setValues} errors={state.fieldErrors} />
          {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
          <div>
            <SubmitButton size="sm" pendingLabel="Enregistrement…">
              Enregistrer
            </SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
