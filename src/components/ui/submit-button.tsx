"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

/** Bouton d'envoi qui affiche un état de chargement et bloque le double envoi. */
export function SubmitButton({ children, pendingLabel, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
      {pending ? (pendingLabel ?? "Un instant…") : children}
    </Button>
  );
}
