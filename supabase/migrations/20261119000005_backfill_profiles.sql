-- Rattrapage : crée le profil des comptes inscrits avant l'application de la migration 0001
-- (le déclencheur on_auth_user_created n'existait pas encore). Sans profil, le parcours de
-- bienvenue ne peut rien enregistrer. Idempotent : ne touche pas aux profils existants.

insert into public.profiles (id, display_name)
select
  u.id,
  left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), ''), 60)
from auth.users u
on conflict (id) do nothing;
