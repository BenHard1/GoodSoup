"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { createCategory, deleteCategory, renameCategory } from "../actions";

type Cat = { id: string; name: string };

export function HouseholdCategories({ householdId, categories }: { householdId: string; categories: Cat[] }) {
  const [state, action] = useActionState(createCategory, initialActionState);
  return (
    <div className="flex flex-col gap-4">
      {categories.length ? (
        <ul className="divide-y divide-line">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">Aucune catégorie personnalisée pour l&apos;instant.</p>
      )}
      <form
        action={action}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        key={state.status === "success" ? state.message : "form"}
      >
        <input type="hidden" name="householdId" value={householdId} />
        <div className="flex-1">
          <Field label="Nouvelle catégorie" error={state.fieldErrors?.name}>
            {(p) => <Input {...p} name="name" maxLength={40} placeholder="ex. Recettes de mamie" required />}
          </Field>
        </div>
        <SubmitButton variant="secondary">Ajouter</SubmitButton>
      </form>
      {state.status === "error" && !state.fieldErrors ? <Alert tone="error">{state.message}</Alert> : null}
    </div>
  );
}

function CategoryRow({ category }: { category: Cat }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(renameCategory, initialActionState);
  if (editing && state.status !== "success") {
    return (
      <li className="py-2">
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="categoryId" value={category.id} />
          <div className="flex-1">
            <Field
              label={`Renommer « ${category.name} »`}
              error={state.fieldErrors?.name ?? (state.status === "error" ? state.message : undefined)}
            >
              {(p) => <Input {...p} name="name" defaultValue={category.name} maxLength={40} required autoFocus />}
            </Field>
          </div>
          <SubmitButton size="sm">Enregistrer</SubmitButton>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Annuler
          </Button>
        </form>
      </li>
    );
  }
  return (
    <li className="flex min-h-12 items-center justify-between gap-2 py-1">
      <span className="font-semibold">{category.name}</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setEditing(true)}
          aria-label={`Renommer ${category.name}`}
        >
          <Pencil aria-hidden className="size-4" />
        </Button>
        <ConfirmDialog
          trigger={
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-danger"
              aria-label={`Supprimer ${category.name}`}
            >
              <Trash2 aria-hidden className="size-4" />
            </Button>
          }
          title={`Supprimer « ${category.name} » ?`}
          description={<p>Les recettes ne sont pas supprimées : elles perdent seulement cette catégorie.</p>}
          confirmLabel="Supprimer"
          action={deleteCategory}
          hiddenFields={{ categoryId: category.id }}
        />
      </div>
    </li>
  );
}
