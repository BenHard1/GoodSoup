/** Traduit les erreurs d'authentification Supabase en messages compréhensibles. */
export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null): string {
  switch (error?.code) {
    case "invalid_credentials":
      return "E-mail ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Confirme d'abord ton adresse e-mail grâce au lien reçu.";
    case "user_already_exists":
    case "email_exists":
      return "Un compte existe déjà avec cette adresse.";
    case "weak_password":
      return "Mot de passe trop faible : choisis-en un plus long ou plus varié.";
    case "same_password":
      return "Le nouveau mot de passe doit être différent de l'ancien.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives. Patiente quelques minutes avant de réessayer.";
    case "otp_expired":
      return "Ce lien a expiré. Demande-en un nouveau.";
    default:
      if (error?.status === 429) return "Trop de tentatives. Patiente quelques minutes avant de réessayer.";
      return "Une erreur est survenue. Vérifie ta connexion et réessaie.";
  }
}
