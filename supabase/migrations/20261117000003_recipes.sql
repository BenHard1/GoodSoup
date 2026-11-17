-- Good Soup — 0003 : bibliothèque de recettes
-- Recettes, ingrédients structurés, étapes, photos, catégories, favoris, notes, signalements, quotas.

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------

create or replace function public.immutable_unaccent(p text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p)
$$;

-- Nom normalisé : minuscules, sans accents, espaces simples.
create or replace function public.normalize_name(p text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select regexp_replace(lower(public.immutable_unaccent(trim(p))), '\s+', ' ', 'g')
$$;

-- Vecteur de recherche (titre > tags > description), déclaré immuable pour la colonne générée.
create or replace function public.recipe_search_vector(p_title text, p_tags text[], p_description text)
returns tsvector
language sql
immutable
parallel safe
set search_path = ''
as $$
  select setweight(to_tsvector('french'::regconfig, public.immutable_unaccent(coalesce(p_title, ''))), 'A')
    || setweight(to_tsvector('french'::regconfig, public.immutable_unaccent(coalesce(array_to_string(p_tags, ' '), ''))), 'B')
    || setweight(to_tsvector('french'::regconfig, public.immutable_unaccent(coalesce(p_description, ''))), 'C')
$$;

create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- Quotas anti-abus : refuse l'action si la limite est atteinte sur la fenêtre, sinon l'enregistre.
create table public.rate_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_events_lookup_idx on public.rate_events (user_id, action, created_at desc);
alter table public.rate_events enable row level security;
revoke all on public.rate_events from anon, authenticated;

create or replace function public.check_rate_limit(p_action text, p_max int, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return; -- opérations système
  end if;
  if (
    select count(*) from public.rate_events
    where user_id = v_uid and action = p_action and created_at > now() - p_window
  ) >= p_max then
    raise exception 'Limite atteinte pour aujourd''hui. Réessaie demain.' using errcode = 'P0001';
  end if;
  insert into public.rate_events (user_id, action) values (v_uid, p_action);
  delete from public.rate_events where created_at < now() - interval '30 days' and user_id = v_uid;
end;
$$;
-- Appelée depuis les fonctions et triggers exécutés avec les droits de l'utilisateur :
-- un appel direct ne fait que consommer son propre quota.
revoke execute on function public.check_rate_limit(text, int, interval) from public, anon;
grant execute on function public.check_rate_limit(text, int, interval) to authenticated;

-- ---------------------------------------------------------------------------
-- Référentiels : unités, ingrédients, catégories
-- ---------------------------------------------------------------------------

create type public.unit_kind as enum ('mass', 'volume', 'count', 'other');

create table public.units (
  code text primary key check (char_length(code) between 1 and 20),
  label text not null,
  plural text not null,
  kind public.unit_kind not null,
  to_base numeric, -- vers g (masse) ou ml (volume) ; null si non convertible
  position int not null default 0
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  normalized_name text not null unique,
  category text not null default 'autre',
  default_unit text references public.units (code) on update cascade on delete set null,
  compatible_units text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index ingredients_trgm_idx on public.ingredients using gin (normalized_name extensions.gin_trgm_ops);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade, -- null = catégorie système
  slug text not null check (slug ~ '^[a-z0-9-]{1,40}$'),
  name text not null check (char_length(trim(name)) between 1 and 40),
  position int not null default 100,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (household_id, slug)
);

-- ---------------------------------------------------------------------------
-- Recettes
-- ---------------------------------------------------------------------------

create type public.recipe_visibility as enum ('private', 'household', 'public');
create type public.recipe_difficulty as enum ('easy', 'medium', 'hard');
create type public.recipe_origin as enum (
  'manual', 'copy', 'import_url', 'import_pdf', 'import_photo', 'import_video', 'ai_generated'
);
create type public.moderation_status as enum ('visible', 'hidden');

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  visibility public.recipe_visibility not null default 'private',
  household_can_edit boolean not null default true,

  title text not null check (char_length(trim(title)) between 1 and 150),
  description text check (char_length(description) <= 2000),
  servings int not null default 4 check (servings between 1 and 100),
  prep_minutes int check (prep_minutes between 0 and 10000),
  cook_minutes int check (cook_minutes between 0 and 10000),
  rest_minutes int check (rest_minutes between 0 and 100000),
  total_minutes int generated always as (
    coalesce(prep_minutes, 0) + coalesce(cook_minutes, 0) + coalesce(rest_minutes, 0)
  ) stored,
  difficulty public.recipe_difficulty,
  tips text check (char_length(tips) <= 5000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  diets text[] not null default '{}' check (cardinality(diets) <= 20),
  nutrition jsonb check (nutrition is null or jsonb_typeof(nutrition) = 'object'),
  nutrition_is_estimated boolean not null default true,
  cost_per_serving_cents int check (cost_per_serving_cents between 0 and 100000),
  cost_is_estimated boolean not null default true,

  origin public.recipe_origin not null default 'manual',
  source_url text check (source_url is null or (source_url ~* '^https?://' and char_length(source_url) <= 2000)),
  source_name text check (char_length(source_name) <= 200),
  attribution text check (char_length(attribution) <= 300),
  source_recipe_id uuid references public.recipes (id) on delete set null,
  source_owner_id uuid, -- instantané : auteur de la recette copiée (pas de clé étrangère, survit à sa suppression)

  rights_confirmed_at timestamptz,
  published_at timestamptz,
  moderation_status public.moderation_status not null default 'visible',
  cover_image_id uuid,
  favorites_count int not null default 0,
  copies_count int not null default 0,

  search_vector tsvector generated always as (public.recipe_search_vector(title, tags, description)) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint recipes_household_visibility check (visibility <> 'household' or household_id is not null),
  constraint recipes_public_rights check (visibility <> 'public' or rights_confirmed_at is not null)
);

create index recipes_owner_idx on public.recipes (owner_id, updated_at desc);
create index recipes_household_idx on public.recipes (household_id, visibility) where household_id is not null;
create index recipes_public_idx on public.recipes (published_at desc)
  where visibility = 'public' and moderation_status = 'visible';
create index recipes_search_idx on public.recipes using gin (search_vector);
create index recipes_tags_idx on public.recipes using gin (tags);
create index recipes_diets_idx on public.recipes using gin (diets);
create index recipes_title_trgm_idx on public.recipes using gin (public.normalize_name(title) extensions.gin_trgm_ops);
create index recipes_source_idx on public.recipes (source_recipe_id) where source_recipe_id is not null;

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position int not null check (position >= 0),
  section text check (char_length(section) <= 80),
  name text not null check (char_length(trim(name)) between 1 and 120),
  ingredient_id uuid references public.ingredients (id) on delete set null,
  quantity numeric(12, 3) check (quantity > 0),
  quantity_max numeric(12, 3) check (quantity_max > 0),
  unit_code text references public.units (code) on update cascade on delete set null,
  note text check (char_length(note) <= 200),
  is_optional boolean not null default false,
  constraint recipe_ingredients_range check (quantity_max is null or (quantity is not null and quantity_max >= quantity)),
  unique (recipe_id, position)
);
create index recipe_ingredients_name_trgm_idx on public.recipe_ingredients
  using gin (public.normalize_name(name) extensions.gin_trgm_ops);
create index recipe_ingredients_ingredient_idx on public.recipe_ingredients (ingredient_id);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position int not null check (position >= 0),
  section text check (char_length(section) <= 80),
  instruction text not null check (char_length(trim(instruction)) between 1 and 3000),
  duration_minutes int check (duration_minutes between 0 and 10000),
  unique (recipe_id, position)
);

create table public.recipe_images (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 300),
  position int not null default 0,
  alt_text text check (char_length(alt_text) <= 300),
  width int check (width between 1 and 10000),
  height int check (height between 1 and 10000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index recipe_images_recipe_idx on public.recipe_images (recipe_id, position);

alter table public.recipes
  add constraint recipes_cover_fk foreign key (cover_image_id)
  references public.recipe_images (id) on delete set null;

create table public.recipe_categories (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (recipe_id, category_id)
);
create index recipe_categories_category_idx on public.recipe_categories (category_id);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
create index favorites_recipe_idx on public.favorites (recipe_id);

create table public.recipe_ratings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
create trigger recipe_ratings_set_updated_at
  before update on public.recipe_ratings
  for each row execute function public.set_updated_at();

create table public.recipe_notes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  body text not null check (char_length(body) <= 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
create trigger recipe_notes_set_updated_at
  before update on public.recipe_notes
  for each row execute function public.set_updated_at();

create type public.report_reason as enum ('spam', 'inappropriate', 'copyright', 'dangerous', 'other');
create type public.report_status as enum ('open', 'dismissed', 'actioned');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, recipe_id)
);
create index reports_open_idx on public.reports (created_at) where status = 'open';

-- ---------------------------------------------------------------------------
-- Droits sur une recette
-- ---------------------------------------------------------------------------

create or replace function public.can_read_recipe(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = p_recipe_id
      and (
        r.owner_id = (select auth.uid())
        or (r.visibility = 'household' and public.is_household_member(r.household_id))
        or (r.visibility = 'public' and (r.moderation_status = 'visible' or public.is_app_admin()))
      )
  );
$$;

create or replace function public.can_edit_recipe(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = p_recipe_id
      and (
        r.owner_id = (select auth.uid())
        or (r.visibility = 'household' and r.household_can_edit and public.is_household_member(r.household_id))
      )
  );
$$;

-- L'utilisateur est-il l'auteur d'au moins une recette publique visible ? (pseudonyme consultable)
create or replace function public.is_public_author(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes
    where owner_id = p_user_id and visibility = 'public' and moderation_status = 'visible'
  );
$$;

-- Garde-fous : colonnes système, publication, droits des co-éditeurs du foyer.
create or replace function public.recipes_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Mises à jour système (compteurs, triggers imbriqués) ou hors API.
  if v_uid is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.owner_id := v_uid;
    new.moderation_status := 'visible';
    new.favorites_count := 0;
    new.copies_count := 0;
    perform public.check_rate_limit('recipe_create', 50, interval '1 day');
    if new.origin = 'copy' then
      -- La source doit être lisible ; l'auteur d'origine est relevé ici, jamais fourni par le client.
      select r.owner_id into new.source_owner_id
      from public.recipes r where r.id = new.source_recipe_id;
      if new.source_recipe_id is null or not found then
        raise exception 'Copie invalide' using errcode = '42501';
      end if;
    else
      new.source_recipe_id := null;
      new.source_owner_id := null;
    end if;
  else
    if new.owner_id <> old.owner_id
       or new.origin <> old.origin
       or new.source_recipe_id is distinct from old.source_recipe_id
       or new.source_owner_id is distinct from old.source_owner_id
       or new.created_at <> old.created_at then
      raise exception 'Modification interdite' using errcode = '42501';
    end if;
    new.favorites_count := old.favorites_count;
    new.copies_count := old.copies_count;
    if new.moderation_status <> old.moderation_status and not public.is_app_admin() then
      raise exception 'Seule la modération peut masquer une recette' using errcode = '42501';
    end if;
    if v_uid <> old.owner_id and (
         new.visibility <> old.visibility
         or new.household_id is distinct from old.household_id
         or new.household_can_edit <> old.household_can_edit
         or new.rights_confirmed_at is distinct from old.rights_confirmed_at
       ) then
      raise exception 'Seul l''auteur peut changer le partage de la recette' using errcode = '42501';
    end if;
  end if;

  if new.household_id is not null and not public.is_household_member(new.household_id)
     and (tg_op = 'INSERT' or new.household_id is distinct from old.household_id) then
    raise exception 'Foyer invalide' using errcode = '42501';
  end if;

  if new.visibility = 'public' then
    if new.origin = 'copy' and new.source_owner_id is distinct from new.owner_id then
      raise exception 'La copie d''une recette d''un autre auteur ne peut pas être publiée' using errcode = 'P0001';
    end if;
    if new.rights_confirmed_at is null then
      raise exception 'Confirme que tu as le droit de publier cette recette' using errcode = 'P0001';
    end if;
    if tg_op = 'INSERT' or old.visibility <> 'public' then
      perform public.check_rate_limit('recipe_publish', 10, interval '1 day');
      new.published_at := now();
    end if;
  else
    new.published_at := null;
  end if;

  return new;
end;
$$;

create trigger recipes_guard
  before insert or update on public.recipes
  for each row execute function public.recipes_guard();

-- Compteurs de popularité (favoris, copies).
create or replace function public.favorites_count_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.recipes set favorites_count = favorites_count + 1 where id = new.recipe_id;
  else
    update public.recipes set favorites_count = greatest(favorites_count - 1, 0) where id = old.recipe_id;
  end if;
  return null;
end;
$$;
create trigger favorites_count
  after insert or delete on public.favorites
  for each row execute function public.favorites_count_trigger();

create or replace function public.copies_count_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_recipe_id is not null then
    update public.recipes set copies_count = copies_count + 1 where id = new.source_recipe_id;
  end if;
  return null;
end;
$$;
create trigger recipes_copies_count
  after insert on public.recipes
  for each row execute function public.copies_count_trigger();

-- Quitter un foyer : ses recettes « foyer » redeviennent privées.
create or replace function public.recipes_on_member_leave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.recipes
  set visibility = 'private', household_id = null
  where owner_id = old.user_id and household_id = old.household_id;
  return null;
end;
$$;
create trigger household_members_recipes_private
  after delete on public.household_members
  for each row execute function public.recipes_on_member_leave();

-- Foyer supprimé : household_id passe à NULL ; une recette « foyer » redevient privée.
create or replace function public.recipes_household_nullified()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.household_id is null and new.visibility = 'household' then
    new.visibility := 'private';
  end if;
  return new;
end;
$$;
create trigger recipes_household_nullified
  before update of household_id on public.recipes
  for each row when (new.household_id is null)
  execute function public.recipes_household_nullified();

-- 8 photos maximum par recette.
create or replace function public.recipe_images_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.recipe_images where recipe_id = new.recipe_id) >= 8 then
    raise exception '8 photos maximum par recette' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger recipe_images_limit
  before insert on public.recipe_images
  for each row execute function public.recipe_images_limit();

-- Signalements : quota, et masquage automatique à 3 signalements ouverts distincts.
create or replace function public.reports_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.reporter_id := auth.uid();
  new.status := 'open';
  new.reviewed_by := null;
  new.reviewed_at := null;
  perform public.check_rate_limit('report', 20, interval '1 day');
  return new;
end;
$$;
create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

create or replace function public.reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.reports where recipe_id = new.recipe_id and status = 'open') >= 3 then
    update public.recipes set moderation_status = 'hidden' where id = new.recipe_id;
  end if;
  return null;
end;
$$;
create trigger reports_after_insert
  after insert on public.reports
  for each row execute function public.reports_after_insert();

-- ---------------------------------------------------------------------------
-- Enregistrement atomique d'une recette (création ou modification)
-- ---------------------------------------------------------------------------

create or replace function public.save_recipe(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := public.try_uuid(p ->> 'id');
  v_existing public.recipes;
  v_is_owner boolean;
  v_visibility public.recipe_visibility := coalesce((p ->> 'visibility')::public.recipe_visibility, 'private');
  v_household uuid := public.try_uuid(p ->> 'household_id');
  v_rights boolean := coalesce((p ->> 'rights_confirmed')::boolean, false);
begin
  if v_uid is null then
    raise exception 'Non connecté' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p -> 'ingredients', '[]')) > 100 then
    raise exception '100 ingrédients maximum' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p -> 'steps', '[]')) > 60 then
    raise exception '60 étapes maximum' using errcode = 'P0001';
  end if;
  if v_visibility <> 'household' and v_visibility <> 'public' then
    v_household := case when v_visibility = 'private' then null else v_household end;
  end if;

  if v_id is null then
    insert into public.recipes (
      owner_id, household_id, visibility, household_can_edit, title, description, servings,
      prep_minutes, cook_minutes, rest_minutes, difficulty, tips, tags, diets,
      nutrition, nutrition_is_estimated, cost_per_serving_cents, cost_is_estimated,
      origin, source_url, source_name, attribution, rights_confirmed_at
    ) values (
      v_uid,
      case when v_visibility = 'household' then v_household end,
      v_visibility,
      coalesce((p ->> 'household_can_edit')::boolean, true),
      trim(p ->> 'title'),
      nullif(trim(p ->> 'description'), ''),
      coalesce((p ->> 'servings')::int, 4),
      (p ->> 'prep_minutes')::int,
      (p ->> 'cook_minutes')::int,
      (p ->> 'rest_minutes')::int,
      (p ->> 'difficulty')::public.recipe_difficulty,
      nullif(trim(p ->> 'tips'), ''),
      coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'),
      coalesce(array(select jsonb_array_elements_text(p -> 'diets')), '{}'),
      p -> 'nutrition',
      coalesce((p ->> 'nutrition_is_estimated')::boolean, true),
      (p ->> 'cost_per_serving_cents')::int,
      coalesce((p ->> 'cost_is_estimated')::boolean, true),
      'manual',
      nullif(trim(p ->> 'source_url'), ''),
      nullif(trim(p ->> 'source_name'), ''),
      nullif(trim(p ->> 'attribution'), ''),
      case when v_rights then now() end
    )
    returning id into v_id;
  else
    select * into v_existing from public.recipes where id = v_id for update;
    if not found or not public.can_edit_recipe(v_id) then
      raise exception 'Recette introuvable ou non modifiable' using errcode = '42501';
    end if;
    if p ? 'expected_updated_at'
       and date_trunc('milliseconds', v_existing.updated_at)
           <> date_trunc('milliseconds', (p ->> 'expected_updated_at')::timestamptz) then
      raise exception 'Cette recette a été modifiée entre-temps par quelqu''un d''autre. Recharge la page pour voir la dernière version.'
        using errcode = 'PT409';
    end if;
    v_is_owner := v_existing.owner_id = v_uid;

    update public.recipes set
      title = trim(p ->> 'title'),
      description = nullif(trim(p ->> 'description'), ''),
      servings = coalesce((p ->> 'servings')::int, 4),
      prep_minutes = (p ->> 'prep_minutes')::int,
      cook_minutes = (p ->> 'cook_minutes')::int,
      rest_minutes = (p ->> 'rest_minutes')::int,
      difficulty = (p ->> 'difficulty')::public.recipe_difficulty,
      tips = nullif(trim(p ->> 'tips'), ''),
      tags = coalesce(array(select jsonb_array_elements_text(p -> 'tags')), '{}'),
      diets = coalesce(array(select jsonb_array_elements_text(p -> 'diets')), '{}'),
      nutrition = p -> 'nutrition',
      nutrition_is_estimated = coalesce((p ->> 'nutrition_is_estimated')::boolean, true),
      cost_per_serving_cents = (p ->> 'cost_per_serving_cents')::int,
      cost_is_estimated = coalesce((p ->> 'cost_is_estimated')::boolean, true),
      source_url = nullif(trim(p ->> 'source_url'), ''),
      source_name = nullif(trim(p ->> 'source_name'), ''),
      attribution = case when v_existing.origin = 'copy' then v_existing.attribution
                         else nullif(trim(p ->> 'attribution'), '') end,
      visibility = case when v_is_owner then v_visibility else v_existing.visibility end,
      household_id = case when not v_is_owner then v_existing.household_id
                          when v_visibility = 'household' then v_household
                          else null end,
      household_can_edit = case when v_is_owner then coalesce((p ->> 'household_can_edit')::boolean, true)
                                else v_existing.household_can_edit end,
      rights_confirmed_at = case when not v_is_owner then v_existing.rights_confirmed_at
                                 when v_rights then coalesce(v_existing.rights_confirmed_at, now())
                                 else null end
    where id = v_id;

    delete from public.recipe_ingredients where recipe_id = v_id;
    delete from public.recipe_steps where recipe_id = v_id;
    delete from public.recipe_categories where recipe_id = v_id;
  end if;

  insert into public.recipe_ingredients (
    recipe_id, position, section, name, ingredient_id, quantity, quantity_max, unit_code, note, is_optional
  )
  select v_id,
         (x.ord - 1)::int,
         nullif(trim(x.item ->> 'section'), ''),
         trim(x.item ->> 'name'),
         (select i.id from public.ingredients i where i.normalized_name = public.normalize_name(x.item ->> 'name')),
         (x.item ->> 'quantity')::numeric,
         (x.item ->> 'quantity_max')::numeric,
         nullif(x.item ->> 'unit_code', ''),
         nullif(trim(x.item ->> 'note'), ''),
         coalesce((x.item ->> 'is_optional')::boolean, false)
  from jsonb_array_elements(coalesce(p -> 'ingredients', '[]')) with ordinality as x(item, ord);

  insert into public.recipe_steps (recipe_id, position, section, instruction, duration_minutes)
  select v_id,
         (x.ord - 1)::int,
         nullif(trim(x.item ->> 'section'), ''),
         trim(x.item ->> 'instruction'),
         (x.item ->> 'duration_minutes')::int
  from jsonb_array_elements(coalesce(p -> 'steps', '[]')) with ordinality as x(item, ord);

  insert into public.recipe_categories (recipe_id, category_id)
  select distinct v_id, c.id
  from jsonb_array_elements_text(coalesce(p -> 'category_ids', '[]')) as cid
  join public.categories c on c.id = public.try_uuid(cid);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Copie personnelle d'une recette (indépendante de l'original)
-- ---------------------------------------------------------------------------

create or replace function public.copy_recipe(p_source_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_src public.recipes;
  v_author text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Non connecté' using errcode = '42501';
  end if;
  select * into v_src from public.recipes where id = p_source_id;
  if not found then
    raise exception 'Recette introuvable' using errcode = '42501';
  end if;
  perform public.check_rate_limit('recipe_copy', 30, interval '1 day');

  select nullif(n.display_name, '') into v_author from public.get_display_names(array[v_src.owner_id]) n;

  insert into public.recipes (
    owner_id, visibility, title, description, servings, prep_minutes, cook_minutes, rest_minutes,
    difficulty, tips, tags, diets, nutrition, nutrition_is_estimated, cost_per_serving_cents,
    cost_is_estimated, origin, source_url, source_name, attribution, source_recipe_id, source_owner_id
  ) values (
    v_uid, 'private', v_src.title, v_src.description, v_src.servings, v_src.prep_minutes,
    v_src.cook_minutes, v_src.rest_minutes, v_src.difficulty, v_src.tips, v_src.tags, v_src.diets,
    v_src.nutrition, v_src.nutrition_is_estimated, v_src.cost_per_serving_cents, v_src.cost_is_estimated,
    'copy', v_src.source_url, v_src.source_name,
    coalesce(
      v_src.attribution,
      case when v_src.owner_id = v_uid then null
           else 'D''après une recette partagée par ' || coalesce(v_author, 'un membre de Good Soup') end
    ),
    v_src.id,
    v_src.owner_id
  )
  returning id into v_id;

  insert into public.recipe_ingredients (
    recipe_id, position, section, name, ingredient_id, quantity, quantity_max, unit_code, note, is_optional
  )
  select v_id, position, section, name, ingredient_id, quantity, quantity_max, unit_code, note, is_optional
  from public.recipe_ingredients where recipe_id = v_src.id;

  insert into public.recipe_steps (recipe_id, position, section, instruction, duration_minutes)
  select v_id, position, section, instruction, duration_minutes
  from public.recipe_steps where recipe_id = v_src.id;

  -- Seules les catégories système suivent la copie (les catégories d'un foyer lui appartiennent).
  insert into public.recipe_categories (recipe_id, category_id)
  select v_id, rc.category_id
  from public.recipe_categories rc
  join public.categories c on c.id = rc.category_id and c.household_id is null
  where rc.recipe_id = v_src.id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recherche dans la bibliothèque
-- ---------------------------------------------------------------------------

create or replace function public.search_recipes(
  p_scope text,                     -- 'mine' | 'household' | 'favorites' | 'public' | 'author'
  p_query text default null,
  p_household_id uuid default null,
  p_author_id uuid default null,
  p_category_ids uuid[] default null,
  p_max_minutes int default null,
  p_min_minutes int default null,
  p_difficulty public.recipe_difficulty default null,
  p_diets text[] default null,
  p_sort text default 'recent',      -- 'recent' | 'updated' | 'alpha' | 'popular'
  p_limit int default 24,
  p_offset int default 0
)
returns setof public.recipes
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select nullif(trim(p_query), '') as text,
           public.normalize_name(nullif(trim(p_query), '')) as norm
  )
  select r.*
  from public.recipes r, q
  where
    case p_scope
      when 'mine' then r.owner_id = (select auth.uid())
      when 'household' then r.visibility = 'household' and r.household_id = p_household_id
      when 'favorites' then exists (
        select 1 from public.favorites f where f.recipe_id = r.id and f.user_id = (select auth.uid())
      )
      when 'public' then r.visibility = 'public' and r.moderation_status = 'visible'
      when 'author' then r.owner_id = p_author_id and r.visibility = 'public' and r.moderation_status = 'visible'
      else false
    end
    and (
      q.text is null
      or r.search_vector @@ websearch_to_tsquery('french'::regconfig, public.immutable_unaccent(q.text))
      or public.normalize_name(r.title) like '%' || q.norm || '%'
      or exists (
        select 1 from public.recipe_ingredients ri
        where ri.recipe_id = r.id and public.normalize_name(ri.name) like '%' || q.norm || '%'
      )
    )
    and (p_category_ids is null or cardinality(p_category_ids) = 0 or exists (
      select 1 from public.recipe_categories rc
      where rc.recipe_id = r.id and rc.category_id = any (p_category_ids)
    ))
    and (p_max_minutes is null or (r.total_minutes > 0 and r.total_minutes <= p_max_minutes))
    and (p_min_minutes is null or r.total_minutes >= p_min_minutes)
    and (p_difficulty is null or r.difficulty = p_difficulty)
    and (p_diets is null or cardinality(p_diets) = 0 or r.diets @> p_diets)
  order by
    case when p_sort = 'alpha' then public.normalize_name(r.title) end asc,
    case when p_sort = 'popular' then r.favorites_count + r.copies_count end desc,
    case when p_sort = 'updated' then r.updated_at end desc,
    r.created_at desc,
    r.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- Modération (administrateurs)
-- ---------------------------------------------------------------------------

create or replace function public.moderate_recipe(
  p_recipe_id uuid,
  p_status public.moderation_status,
  p_report_status public.report_status default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Réservé à la modération' using errcode = '42501';
  end if;
  update public.recipes set moderation_status = p_status where id = p_recipe_id;
  if p_report_status is not null then
    update public.reports
    set status = p_report_status, reviewed_by = auth.uid(), reviewed_at = now()
    where recipe_id = p_recipe_id and status = 'open';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.units enable row level security;
alter table public.ingredients enable row level security;
alter table public.categories enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.recipe_images enable row level security;
alter table public.recipe_categories enable row level security;
alter table public.favorites enable row level security;
alter table public.recipe_ratings enable row level security;
alter table public.recipe_notes enable row level security;
alter table public.reports enable row level security;

create policy "units: lecture" on public.units for select to authenticated using (true);
create policy "ingredients: lecture" on public.ingredients for select to authenticated using (true);

create policy "categories: système et foyers de l'utilisateur" on public.categories for select to authenticated
  using (household_id is null or public.is_household_member(household_id));
create policy "categories: un membre crée pour son foyer" on public.categories for insert to authenticated
  with check (household_id is not null and public.is_household_member(household_id) and created_by = (select auth.uid()));
create policy "categories: un membre renomme" on public.categories for update to authenticated
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));
create policy "categories: un membre supprime" on public.categories for delete to authenticated
  using (household_id is not null and public.is_household_member(household_id));

create policy "recipes: lecture selon la visibilité" on public.recipes for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (visibility = 'household' and public.is_household_member(household_id))
    or (visibility = 'public' and (moderation_status = 'visible' or public.is_app_admin()))
  );
create policy "recipes: création par soi" on public.recipes for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "recipes: modification par l'auteur ou le foyer autorisé" on public.recipes for update to authenticated
  using (
    owner_id = (select auth.uid())
    or (visibility = 'household' and household_can_edit and public.is_household_member(household_id))
  )
  with check (
    owner_id = (select auth.uid())
    or (visibility = 'household' and household_can_edit and public.is_household_member(household_id))
  );
create policy "recipes: suppression par l'auteur" on public.recipes for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Tables enfants : mêmes droits que la recette.
create policy "recipe_ingredients: lecture" on public.recipe_ingredients for select to authenticated
  using (public.can_read_recipe(recipe_id));
create policy "recipe_ingredients: écriture" on public.recipe_ingredients for all to authenticated
  using (public.can_edit_recipe(recipe_id)) with check (public.can_edit_recipe(recipe_id));

create policy "recipe_steps: lecture" on public.recipe_steps for select to authenticated
  using (public.can_read_recipe(recipe_id));
create policy "recipe_steps: écriture" on public.recipe_steps for all to authenticated
  using (public.can_edit_recipe(recipe_id)) with check (public.can_edit_recipe(recipe_id));

create policy "recipe_images: lecture" on public.recipe_images for select to authenticated
  using (public.can_read_recipe(recipe_id));
create policy "recipe_images: écriture" on public.recipe_images for all to authenticated
  using (public.can_edit_recipe(recipe_id))
  with check (public.can_edit_recipe(recipe_id) and storage_path like recipe_id::text || '/%');

create policy "recipe_categories: lecture" on public.recipe_categories for select to authenticated
  using (public.can_read_recipe(recipe_id));
create policy "recipe_categories: écriture" on public.recipe_categories for all to authenticated
  using (public.can_edit_recipe(recipe_id))
  with check (
    public.can_edit_recipe(recipe_id)
    and exists (
      select 1 from public.categories c
      where c.id = category_id and (c.household_id is null or public.is_household_member(c.household_id))
    )
  );

create policy "favorites: les siens" on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy "favorites: ajouter une recette visible" on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_read_recipe(recipe_id));
create policy "favorites: retirer" on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "recipe_ratings: les siennes" on public.recipe_ratings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "recipe_ratings: noter une recette visible" on public.recipe_ratings for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_read_recipe(recipe_id));
create policy "recipe_ratings: modifier la sienne" on public.recipe_ratings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "recipe_ratings: supprimer la sienne" on public.recipe_ratings for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "recipe_notes: les siennes" on public.recipe_notes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "recipe_notes: écrire sur une recette visible" on public.recipe_notes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_read_recipe(recipe_id));
create policy "recipe_notes: modifier la sienne" on public.recipe_notes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "recipe_notes: supprimer la sienne" on public.recipe_notes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "reports: l'auteur du signalement et les admins lisent" on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_app_admin());
create policy "reports: signaler une recette visible d'un autre" on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and public.can_read_recipe(recipe_id)
    and exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.visibility = 'public' and r.owner_id <> (select auth.uid())
    )
  );

-- Pseudonymes : seul le nom affiché est exposé (pas les préférences), pour soi, les membres
-- de ses foyers et les auteurs de recettes publiques.
create or replace function public.get_display_names(p_ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name
  from public.profiles p
  where p.id = any (p_ids)
    and (
      p.id = (select auth.uid())
      or public.shares_household_with(p.id)
      or public.is_public_author(p.id)
    )
  limit 200;
$$;

-- Droits : rien pour les anonymes, référentiels en lecture seule, compteurs non modifiables.
revoke all on public.units, public.ingredients, public.categories, public.recipes,
  public.recipe_ingredients, public.recipe_steps, public.recipe_images, public.recipe_categories,
  public.favorites, public.recipe_ratings, public.recipe_notes, public.reports from anon;
revoke insert, update, delete on public.units, public.ingredients from authenticated;
revoke update, delete on public.reports from authenticated;

revoke execute on function
  public.save_recipe(jsonb),
  public.copy_recipe(uuid),
  public.search_recipes(text, text, uuid, uuid, uuid[], int, int, public.recipe_difficulty, text[], text, int, int),
  public.moderate_recipe(uuid, public.moderation_status, public.report_status),
  public.can_read_recipe(uuid),
  public.can_edit_recipe(uuid),
  public.is_public_author(uuid),
  public.get_display_names(uuid[])
from public, anon;

-- ---------------------------------------------------------------------------
-- Stockage des photos : bucket privé, chemin {recipe_id}/{fichier}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "recipe-images: lecture si la recette est lisible" on storage.objects for select to authenticated
  using (
    bucket_id = 'recipe-images'
    and public.can_read_recipe(public.try_uuid((storage.foldername(name))[1]))
  );
create policy "recipe-images: envoi si la recette est modifiable" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recipe-images'
    and public.can_edit_recipe(public.try_uuid((storage.foldername(name))[1]))
  );
create policy "recipe-images: suppression si la recette est modifiable" on storage.objects for delete to authenticated
  using (
    bucket_id = 'recipe-images'
    and public.can_edit_recipe(public.try_uuid((storage.foldername(name))[1]))
  );
