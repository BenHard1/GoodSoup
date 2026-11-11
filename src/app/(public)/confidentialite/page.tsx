import type { Metadata } from "next";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Politique de confidentialité" };

/**
 * BROUILLON à faire valider : les passages entre crochets doivent être complétés par l'éditeur du service.
 */
export default function PrivacyPage() {
  return (
    <Card className="w-full max-w-3xl p-6 sm:p-10">
      <article className="flex flex-col gap-4 leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6">
        <h1 className="text-3xl font-semibold">Politique de confidentialité</h1>
        <p className="rounded-lg bg-lemon-soft p-3 text-sm font-semibold">
          Brouillon — à compléter avant l&apos;ouverture publique (passages entre crochets).
        </p>
        <h2>Responsable du traitement</h2>
        <p>[Nom ou pseudonyme de l&apos;éditeur], joignable à [adresse e-mail de contact].</p>
        <h2>Données collectées</h2>
        <ul>
          <li>
            Compte : adresse e-mail, mot de passe (stocké sous forme chiffrée par notre prestataire
            d&apos;authentification), pseudonyme.
          </li>
          <li>Foyer : nom du foyer, membres, invitations.</li>
          <li>
            Préférences alimentaires : allergies, régimes, goûts. Ces informations peuvent révéler des données de santé
            ; elles ne sont visibles que des membres de ton foyer et ne servent qu&apos;aux suggestions dans
            l&apos;application.
          </li>
          <li>Recettes et photos que tu ajoutes (à partir de la Phase 1).</li>
        </ul>
        <h2>Finalités et base légale</h2>
        <p>
          Fournir le service que tu demandes en créant un compte (exécution du contrat). Les préférences alimentaires
          sont facultatives et renseignées avec ton consentement explicite ; tu peux les supprimer à tout moment.
        </p>
        <h2>Hébergement et sous-traitants</h2>
        <ul>
          <li>
            Supabase (base de données, authentification, fichiers) — serveurs situés dans l&apos;Union européenne
            (Paris).
          </li>
          <li>Vercel (hébergement de l&apos;application) — [à préciser selon la configuration retenue].</li>
          <li>[Service d&apos;envoi d&apos;e-mails, à préciser].</li>
        </ul>
        <h2>Cookies</h2>
        <p>
          Seuls des cookies strictement nécessaires sont utilisés (maintien de ta session). Aucun cookie publicitaire ni
          outil de mesure d&apos;audience tiers.
        </p>
        <h2>Durée de conservation</h2>
        <p>Tes données sont conservées tant que ton compte existe, puis supprimées lors de sa suppression.</p>
        <h2>Tes droits</h2>
        <p>
          Accès, rectification, effacement, portabilité, opposition et retrait du consentement : la plupart sont
          disponibles directement dans l&apos;application (Profil, Paramètres). Pour le reste, écris à [adresse e-mail
          de contact]. Tu peux aussi saisir la CNIL (cnil.fr).
        </p>
      </article>
    </Card>
  );
}
