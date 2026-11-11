"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { requestPasswordReset, signIn, signUp, updatePassword } from "./actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <Field label="E-mail" error={state.fieldErrors?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" required />}
      </Field>
      <Field label="Mot de passe" error={state.fieldErrors?.password}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <SubmitButton pendingLabel="Connexion…">Se connecter</SubmitButton>
      <p className="text-center text-sm">
        <Link
          href="/mot-de-passe-oublie"
          className="font-semibold text-coral-strong underline-offset-4 hover:underline"
        >
          Mot de passe oublié ?
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      {state.status === "error" && state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <Field label="Prénom ou pseudonyme" error={state.fieldErrors?.displayName}>
        {(p) => <Input {...p} name="displayName" autoComplete="nickname" maxLength={60} required />}
      </Field>
      <Field label="E-mail" error={state.fieldErrors?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" required />}
      </Field>
      <Field label="Mot de passe" hint="10 caractères minimum." error={state.fieldErrors?.password}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" minLength={10} required />}
      </Field>
      <Field label="Confirme le mot de passe" error={state.fieldErrors?.passwordConfirm}>
        {(p) => <Input {...p} name="passwordConfirm" type="password" autoComplete="new-password" required />}
      </Field>
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm">
          <input name="acceptTerms" type="checkbox" className="mt-0.5 size-5 accent-coral-strong" required />
          <span>
            J&apos;ai lu la{" "}
            <Link href="/confidentialite" className="font-semibold text-coral-strong underline" target="_blank">
              politique de confidentialité
            </Link>
            .
          </span>
        </label>
        {state.fieldErrors?.acceptTerms ? (
          <p className="text-sm font-semibold text-danger">{state.fieldErrors.acceptTerms.join(" ")}</p>
        ) : null}
      </div>
      <SubmitButton pendingLabel="Création du compte…">Créer mon compte</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert> : null}
      <Field label="E-mail" error={state.fieldErrors?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" required />}
      </Field>
      <SubmitButton pendingLabel="Envoi…">Recevoir un lien</SubmitButton>
    </form>
  );
}

export function NewPasswordForm({ submitLabel = "Enregistrer le mot de passe" }: { submitLabel?: string }) {
  const [state, action] = useActionState(updatePassword, initialActionState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert> : null}
      <Field label="Nouveau mot de passe" hint="10 caractères minimum." error={state.fieldErrors?.password}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" minLength={10} required />}
      </Field>
      <Field label="Confirme le mot de passe" error={state.fieldErrors?.passwordConfirm}>
        {(p) => <Input {...p} name="passwordConfirm" type="password" autoComplete="new-password" required />}
      </Field>
      <SubmitButton pendingLabel="Enregistrement…">{submitLabel}</SubmitButton>
    </form>
  );
}
