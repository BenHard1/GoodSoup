import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

const inputBase =
  "w-full rounded-field border border-ink-faint bg-white px-4 py-3 text-base text-ink placeholder:text-ink-faint " +
  "focus-visible:border-ink aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputBase, "min-h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputBase, "min-h-24", className)} {...props} />;
}

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string[] | string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
};

/** Champ accessible : libellé relié, aide et erreur annoncées aux lecteurs d'écran. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const errors = Array.isArray(error) ? error : error ? [error] : [];
  const describedBy = [hint ? `${id}-hint` : null, errors.length ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy || undefined, "aria-invalid": errors.length > 0 || undefined })}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
      {errors.length ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}
