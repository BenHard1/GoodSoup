-- Good Soup — 0002 : foyers, membres, invitations, profils alimentaires

create type public.household_role as enum ('owner', 'member');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_by uuid references auth.users (id) on delete set null,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_idx on public.household_members (user_id);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token_hash text not null unique,
  role public.household_role not null default 'member',
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  max_uses int not null default 5 check (max_uses between 1 and 20),
  used_count int not null default 0 check (used_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index household_invitations_household_idx on public.household_invitations (household_id);

create table public.food_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 60),
  allergies text[] not null default '{}' check (cardinality(allergies) <= 50),
  exclusions text[] not null default '{}' check (cardinality(exclusions) <= 100),
  likes text[] not null default '{}' check (cardinality(likes) <= 100),
  dislikes text[] not null default '{}' check (cardinality(dislikes) <= 100),
  diets text[] not null default '{}' check (cardinality(diets) <= 20),
  goals text check (char_length(goals) <= 500),
  portion_factor numeric(3, 2) not null default 1 check (portion_factor between 0.25 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create index food_profiles_household_idx on public.food_profiles (household_id);

create trigger food_profiles_set_updated_at
  before update on public.food_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Fonctions de contrôle (réutilisées par toutes les politiques RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_household_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

-- Deux utilisateurs partagent-ils au moins un foyer ?
create or replace function public.shares_household_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members a
    join public.household_members b on a.household_id = b.household_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Cohérence : un foyer sans membre disparaît, un foyer garde toujours un propriétaire
-- ---------------------------------------------------------------------------

create or replace function public.household_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next uuid;
begin
  if not exists (select 1 from public.households where id = old.household_id) then
    return null; -- le foyer lui-même est en cours de suppression
  end if;

  if not exists (select 1 from public.household_members where household_id = old.household_id) then
    delete from public.households where id = old.household_id;
    return null;
  end if;

  if not exists (
    select 1 from public.household_members
    where household_id = old.household_id and role = 'owner'
  ) then
    select user_id into v_next
    from public.household_members
    where household_id = old.household_id
    order by joined_at, user_id
    limit 1;

    update public.household_members
    set role = 'owner'
    where household_id = old.household_id and user_id = v_next;
  end if;

  return null;
end;
$$;

create trigger household_members_after_delete
  after delete on public.household_members
  for each row execute function public.household_members_after_delete();

-- ---------------------------------------------------------------------------
-- Opérations (RPC) : seules portes d'entrée pour créer, rejoindre, quitter
-- ---------------------------------------------------------------------------

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Non connecté' using errcode = '42501';
  end if;
  if (select count(*) from public.household_members where user_id = v_uid) >= 10 then
    raise exception 'Nombre maximal de foyers atteint' using errcode = 'P0001';
  end if;

  insert into public.households (name, created_by)
  values (trim(p_name), v_uid)
  returning id into v_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_id, v_uid, 'owner');

  return v_id;
end;
$$;

-- Renvoie le jeton en clair UNE seule fois ; seul son hachage est stocké.
create or replace function public.create_household_invitation(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.is_household_owner(p_household_id) then
    raise exception 'Seul le propriétaire du foyer peut inviter' using errcode = '42501';
  end if;
  if (
    select count(*) from public.household_invitations
    where household_id = p_household_id
      and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'Trop d''invitations créées aujourd''hui' using errcode = 'P0001';
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.household_invitations (household_id, token_hash, invited_by)
  values (p_household_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid());

  return v_token;
end;
$$;

-- Aperçu d'une invitation (nom du foyer) avant acceptation.
create or replace function public.get_invitation_preview(p_token text)
returns table (household_name text, is_valid boolean, already_member boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv public.household_invitations;
begin
  if auth.uid() is null then
    raise exception 'Non connecté' using errcode = '42501';
  end if;

  select * into v_inv
  from public.household_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then
    return query select null::text, false, false;
    return;
  end if;

  return query
  select h.name,
         (v_inv.revoked_at is null and v_inv.expires_at > now() and v_inv.used_count < v_inv.max_uses),
         public.is_household_member(v_inv.household_id)
  from public.households h
  where h.id = v_inv.household_id;
end;
$$;

create or replace function public.accept_household_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.household_invitations;
begin
  if v_uid is null then
    raise exception 'Non connecté' using errcode = '42501';
  end if;

  select * into v_inv
  from public.household_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found
     or v_inv.revoked_at is not null
     or v_inv.expires_at <= now()
     or v_inv.used_count >= v_inv.max_uses then
    raise exception 'Invitation invalide ou expirée' using errcode = 'P0001';
  end if;

  if public.is_household_member(v_inv.household_id) then
    return v_inv.household_id;
  end if;

  if (select count(*) from public.household_members where user_id = v_uid) >= 10 then
    raise exception 'Nombre maximal de foyers atteint' using errcode = 'P0001';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_inv.household_id, v_uid, v_inv.role);

  update public.household_invitations
  set used_count = used_count + 1
  where id = v_inv.id;

  return v_inv.household_id;
end;
$$;

create or replace function public.revoke_household_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid;
begin
  select household_id into v_household
  from public.household_invitations where id = p_invitation_id;

  if v_household is null or not public.is_household_owner(v_household) then
    raise exception 'Action non autorisée' using errcode = '42501';
  end if;

  update public.household_invitations
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invitation_id;
end;
$$;

create or replace function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Vous ne faites pas partie de ce foyer' using errcode = '42501';
  end if;
  delete from public.household_members
  where household_id = p_household_id and user_id = auth.uid();
end;
$$;

create or replace function public.remove_household_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_owner(p_household_id) then
    raise exception 'Seul le propriétaire peut retirer un membre' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Utilisez « Quitter le foyer »' using errcode = 'P0001';
  end if;
  delete from public.household_members
  where household_id = p_household_id and user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.food_profiles enable row level security;

create policy "households: les membres lisent"
  on public.households for select to authenticated
  using (public.is_household_member(id));

create policy "households: le propriétaire renomme"
  on public.households for update to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));

create policy "household_members: les membres se voient"
  on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

create policy "household_invitations: le propriétaire voit"
  on public.household_invitations for select to authenticated
  using (public.is_household_owner(household_id));

create policy "food_profiles: les membres lisent"
  on public.food_profiles for select to authenticated
  using (public.is_household_member(household_id));

create policy "food_profiles: les membres ajoutent"
  on public.food_profiles for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and (
      user_id is null
      or user_id = (select auth.uid())
    )
  );

create policy "food_profiles: les membres modifient"
  on public.food_profiles for update to authenticated
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id)
    and (
      user_id is null
      or user_id = (select auth.uid())
      or exists (
        select 1 from public.household_members m
        where m.household_id = food_profiles.household_id and m.user_id = food_profiles.user_id
      )
    )
  );

create policy "food_profiles: les membres suppriment"
  on public.food_profiles for delete to authenticated
  using (public.is_household_member(household_id));

-- Les membres d'un même foyer voient le pseudonyme les uns des autres.
create policy "profiles: les membres du foyer se voient"
  on public.profiles for select to authenticated
  using (public.shares_household_with(id));

-- Droits : pas d'accès anonyme ; écritures directes limitées à ce que la RLS autorise.
revoke all on public.households, public.household_members,
  public.household_invitations, public.food_profiles from anon;
revoke insert, delete on public.households from authenticated;
revoke insert, update, delete on public.household_members from authenticated;
revoke insert, update, delete on public.household_invitations from authenticated;
revoke update (id, created_by, created_at) on public.households from authenticated;

revoke execute on function
  public.create_household(text),
  public.create_household_invitation(uuid),
  public.get_invitation_preview(text),
  public.accept_household_invitation(text),
  public.revoke_household_invitation(uuid),
  public.leave_household(uuid),
  public.remove_household_member(uuid, uuid)
from public, anon;
