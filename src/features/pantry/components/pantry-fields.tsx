"use client";

import { Field, Input } from "@/components/ui/field";
import { LOCATIONS, type PantryLocation } from "../schemas";

export type PantryFieldValues = {
  name: string;
  brand: string;
  quantity: string;
  location: PantryLocation;
  expiresOn: string;
  barcode: string;
};

export const emptyPantryValues = (location: PantryLocation = "fridge"): PantryFieldValues => ({
  name: "",
  brand: "",
  quantity: "",
  location,
  expiresOn: "",
  barcode: "",
});

const selectCls =
  "min-h-12 w-full rounded-field border border-ink-faint bg-white px-3 text-base text-ink focus-visible:border-ink";

/** Champs communs à l'ajout et à la modification d'un produit (contrôlés pour le pré-remplissage). */
export function PantryFields({
  values,
  onChange,
  errors,
}: {
  values: PantryFieldValues;
  onChange: (values: PantryFieldValues) => void;
  errors?: Record<string, string[] | undefined>;
}) {
  const set = (key: keyof PantryFieldValues) => (e: { target: { value: string } }) =>
    onChange({ ...values, [key]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="barcode" value={values.barcode} />
      <div className="sm:col-span-2">
        <Field label="Produit" error={errors?.name}>
          {(p) => (
            <Input
              {...p}
              name="name"
              value={values.name}
              onChange={set("name")}
              maxLength={80}
              required
              placeholder="Yaourts nature, poireaux…"
            />
          )}
        </Field>
      </div>
      <Field label="Quantité (facultatif)" error={errors?.quantity}>
        {(p) => (
          <Input
            {...p}
            name="quantity"
            value={values.quantity}
            onChange={set("quantity")}
            maxLength={40}
            placeholder="4 pots, 500 g…"
          />
        )}
      </Field>
      <Field label="À consommer avant (facultatif)" error={errors?.expiresOn}>
        {(p) => <Input {...p} type="date" name="expiresOn" value={values.expiresOn} onChange={set("expiresOn")} />}
      </Field>
      <Field label="Rangé dans" error={errors?.location}>
        {(p) => (
          <select {...p} name="location" value={values.location} onChange={set("location")} className={selectCls}>
            {LOCATIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Marque (facultatif)" error={errors?.brand}>
        {(p) => <Input {...p} name="brand" value={values.brand} onChange={set("brand")} maxLength={80} />}
      </Field>
    </div>
  );
}
