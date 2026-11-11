import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Adresse e-mail invalide." }));

export const passwordSchema = z
  .string()
  .min(10, { error: "10 caractères minimum." })
  .max(72, { error: "72 caractères maximum." });

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Indique un prénom ou un pseudonyme." })
  .max(60, { error: "60 caractères maximum." });

export const signUpSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    acceptTerms: z.literal("on", { error: "Merci d'accepter la politique de confidentialité." }),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    error: "Les deux mots de passe ne correspondent pas.",
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Saisis ton mot de passe." }),
});

export const newPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    error: "Les deux mots de passe ne correspondent pas.",
  });
