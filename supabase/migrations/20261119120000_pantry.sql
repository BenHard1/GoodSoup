-- Good Soup — Phase 3 : le frigo du foyer (« ce que j'ai »)
--
-- Une liste simple par foyer : produit, quantité libre, emplacement, date de péremption.
-- Aucun décompte automatique quand une recette est cuisinée.
--
-- Idempotente : peut être collée plusieurs fois dans le SQL Editor sans erreur.

create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  brand text check (brand is null or char_length(brand) <= 80),
  -- Quantité libre (« 2 pots », « 500 g », « un reste ») : pas de calcul dessus.
  quantity text check (quantity is null or char_length(quantity) <= 40),
  location text not null default 'fridge' check (location in ('fridge', 'freezer', 'pantry')),
  expires_on date,
  barcode text check (barcode is null or barcode ~ '^[0-9]{8,14}$'),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pantry_items_household_idx on public.pantry_items (household_id, expires_on);

drop trigger if exists pantry_items_set_updated_at on public.pantry_items;
create trigger pantry_items_set_updated_at
  before update on public.pantry_items
  for each row execute function public.set_updated_at();

-- Garde-fous : 500 produits maximum par foyer, et le foyer d'un produit ne change pas.
create or replace function public.pantry_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.pantry_items where household_id = new.household_id) >= 500 then
      raise exception 'Le frigo du foyer est plein (500 produits maximum).' using errcode = 'P0001';
    end if;
  -- added_by peut seulement passer à null (suppression du compte de l'auteur).
  elsif new.household_id <> old.household_id
     or (new.added_by is distinct from old.added_by and new.added_by is not null) then
    raise exception 'Le foyer et l''auteur d''un produit ne peuvent pas changer.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists pantry_items_guard on public.pantry_items;
create trigger pantry_items_guard
  before insert or update on public.pantry_items
  for each row execute function public.pantry_items_guard();

-- ---------------------------------------------------------------------------
-- Droits : tous les membres du foyer lisent et modifient le frigo du foyer.
-- ---------------------------------------------------------------------------

alter table public.pantry_items enable row level security;
revoke all on public.pantry_items from anon;
grant select, insert, update, delete on public.pantry_items to authenticated;

drop policy if exists "pantry_items: lecture par le foyer" on public.pantry_items;
create policy "pantry_items: lecture par le foyer" on public.pantry_items for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "pantry_items: ajout par un membre" on public.pantry_items;
create policy "pantry_items: ajout par un membre" on public.pantry_items for insert to authenticated
  with check (public.is_household_member(household_id) and added_by = (select auth.uid()));

drop policy if exists "pantry_items: modification par un membre" on public.pantry_items;
create policy "pantry_items: modification par un membre" on public.pantry_items for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "pantry_items: suppression par un membre" on public.pantry_items;
create policy "pantry_items: suppression par un membre" on public.pantry_items for delete to authenticated
  using (public.is_household_member(household_id));
