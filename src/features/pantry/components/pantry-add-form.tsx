"use client";

import { Plus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { addPantryItem, lookupBarcode, type BarcodeLookup } from "../actions";
import { OFF_SOURCE } from "../openfoodfacts";
import type { PantryLocation } from "../schemas";
import { BarcodeScanner } from "./barcode-scanner";
import { PantryFields, emptyPantryValues } from "./pantry-fields";

export function PantryAddForm({ householdId, location }: { householdId: string; location: PantryLocation }) {
  const [values, setValues] = useState(() => emptyPantryValues(location));
  const [lookup, setLookup] = useState<BarcodeLookup | null>(null);
  const [looking, startLookup] = useTransition();
  const [state, action] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await addPantryItem(prev, formData);
    if (result.status === "success") {
      setValues(emptyPantryValues(values.location));
      setLookup(null);
    }
    return result;
  }, initialActionState);

  const onCode = (code: string) =>
    startLookup(async () => {
      const result = await lookupBarcode(code);
      setLookup(result);
      if (result.status === "found") {
        setValues((v) => ({
          ...v,
          barcode: result.barcode,
          name: result.product.name,
          brand: result.product.brand ?? "",
          quantity: result.product.quantity ?? v.quantity,
        }));
      } else if (result.status === "not_found") {
        setValues((v) => ({ ...v, barcode: result.barcode }));
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <BarcodeScanner onCode={onCode} busy={looking} />
      <div aria-live="polite">
        {looking ? <p className="text-sm text-ink-soft">Recherche du produit…</p> : null}
        {!looking && lookup?.status === "found" ? (
          <Alert tone="success">
            Produit trouvé : vérifie le nom et ajoute la date de péremption.{" "}
            <span className="font-normal">
              Source :{" "}
              <a
                href={`${OFF_SOURCE.url}/product/${lookup.barcode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {OFF_SOURCE.name}
              </a>{" "}
              (licence {OFF_SOURCE.license}).
            </span>
          </Alert>
        ) : null}
        {!looking && lookup?.status === "not_found" ? (
          <Alert tone="info">
            Ce produit n&apos;est pas encore dans {OFF_SOURCE.name}. Indique son nom : le code-barres sera gardé.
          </Alert>
        ) : null}
        {!looking && lookup?.status === "error" ? <Alert tone="error">{lookup.message}</Alert> : null}
      </div>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="householdId" value={householdId} />
        <PantryFields values={values} onChange={setValues} errors={state.fieldErrors} />
        {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
        {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}
        <div>
          <SubmitButton pendingLabel="Ajout…">
            <Plus aria-hidden className="size-4" /> Ajouter
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
