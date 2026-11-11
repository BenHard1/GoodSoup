# Good Soup

Application web culinaire (PWA) : bibliothèque de recettes, foyers partagés, puis frigo, menus, courses et assistant IA.

- **Stack** : Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4, Supabase (PostgreSQL + RLS, Auth, Storage), Vercel.
- **Plan de référence** : document « Good Soup — Plan Phase 0 et Phase 1 ».

## État d'avancement

| Phase | Contenu | État |
| --- | --- | --- |
| 0 | Comptes, foyers, invitations, profils alimentaires, design system, navigation, PWA installable | En cours de validation |
| 1 | Bibliothèque de recettes | À venir |
| 2 à 6 | Import, frigo, menus et courses, assistant IA, intégrations | À venir |

Les espaces Recettes, Découvrir, Frigo, Menus, Courses et Assistant affichent pour l'instant un panneau « Arrive en Phase N » : aucune fonctionnalité n'est simulée.

## Démarrer en local

Prérequis : Node.js 20.9+ et Docker (pour Supabase local).

```bash
npm install
npm run db:start            # démarre Supabase local et applique supabase/migrations
npx supabase status -o env  # affiche l'URL, les clés et l'URL de la base locale
cp .env.example .env.local  # puis renseigner les valeurs affichées ci-dessus
npm run dev                 # http://localhost:3000
```

Les e-mails (confirmation, mot de passe oublié) sont capturés localement par Mailpit : http://127.0.0.1:54324.

## Variables d'environnement

| Variable | Navigateur | Rôle |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | oui | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | oui | Clé publique (publishable / anon), protégée par la RLS |
| `NEXT_PUBLIC_SITE_URL` | oui | URL publique de l'app (liens d'e-mail et d'invitation) |
| `SUPABASE_SECRET_KEY` | **non** | Clé secrète (secret / service_role). Serveur uniquement : suppression de compte |
| `AI_PROVIDER` | non | `none` tant que l'IA n'est pas activée |

Les variables sont validées au démarrage (`src/lib/env.ts`, `src/lib/env.server.ts`). Aucun secret n'est versionné.

## Tests

```bash
npm test            # tests unitaires (Vitest)
npm run test:db     # tests de sécurité RLS contre la base (TEST_DATABASE_URL)
npm run test:e2e    # parcours utilisateurs Playwright, mobile et ordinateur (nécessite Supabase local + build)
```

Sans Docker, `npm run db:local-shim` crée une base PostgreSQL nue avec une imitation minimale de Supabase
(`tests/db/local-shim.sql`) pour exécuter `npm run test:db` (`LOCAL_PG_URL` pointe vers ce PostgreSQL).

La CI GitHub (`.github/workflows/ci.yml`) exécute lint, types, tests unitaires et build, puis démarre un vrai Supabase local
pour lancer les tests RLS et les parcours Playwright.

## Organisation

```text
src/app/(public)     connexion, inscription, mot de passe, pages légales
src/app/(app)        pages connectées avec navigation (accueil, foyer, profil, paramètres, modules à venir)
src/app/bienvenue    parcours de première connexion
src/app/auth/confirm lien reçu par e-mail
src/features/*       logique par module : actions serveur, requêtes, schémas Zod, composants
src/components       design system et mise en page
src/lib              clients Supabase, environnement, utilitaires, point d'extension IA
src/proxy.ts         session Supabase, redirections, Content-Security-Policy
supabase/migrations  schéma SQL versionné, RLS comprise
supabase/templates   e-mails d'authentification en français
tests/               unit, db (RLS), e2e (Playwright)
```

## Sécurité

- Toutes les tables ont la Row Level Security activée ; les opérations sensibles (créer, rejoindre, quitter un foyer, inviter)
  passent par des fonctions SQL qui vérifient les droits.
- Les invitations sont des liens à usage limité (7 jours, 5 utilisations) dont seul le hachage est stocké.
- Les administrateurs sont listés dans une table séparée (`app_admins`), impossible à modifier depuis l'application.
- En-têtes : CSP avec nonce, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`.

## Déploiement

1. Créer deux projets Supabase (staging et production), région Paris.
2. Dans chaque projet : Authentication > URL Configuration (Site URL et Redirect URLs), activer la confirmation d'e-mail,
   mot de passe de 10 caractères minimum, coller les modèles de `supabase/templates/`, configurer un SMTP.
3. Secrets GitHub pour `.github/workflows/migrate.yml` : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID_STAGING`,
   `SUPABASE_DB_PASSWORD_STAGING`, `SUPABASE_PROJECT_ID_PROD`, `SUPABASE_DB_PASSWORD_PROD`.
4. Vercel : importer le dépôt, région des fonctions Paris (cdg1), variables d'environnement (production → projet prod,
   preview → projet staging).
5. Se déclarer administrateur après la première inscription (SQL Editor) :
   `insert into public.app_admins (user_id) select id from auth.users where email = 'ton@email';`
