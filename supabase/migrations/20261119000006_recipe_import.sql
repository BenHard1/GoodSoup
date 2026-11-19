-- Phase 2 : import de recettes (lien, PDF, photo), sans IA.
-- Rejouable sans erreur : uniquement des « create or replace » (aucune table, aucun type nouveau).
--
-- save_recipe accepte désormais une origine d'import à la création :
--   - origines acceptées : import_url, import_pdf, import_photo (toute autre valeur → manual) ;
--   - une recette importée est toujours créée privée, sans confirmation de droits : la publier
--     plus tard reste soumis à la confirmation des droits, comme pour toute recette ;
--   - un import par lien garde obligatoirement l'adresse de sa source.
-- L'origine n'est jamais modifiable ensuite (garde-fou recipes_guard existant).

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
  v_origin public.recipe_origin := case
    when p ->> 'origin' in ('import_url', 'import_pdf', 'import_photo') then (p ->> 'origin')::public.recipe_origin
    else 'manual'
  end;
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
    if v_origin <> 'manual' then
      -- Une recette importée reste privée à la création ; elle se partage ensuite comme les autres.
      v_visibility := 'private';
      v_household := null;
      v_rights := false;
      if v_origin = 'import_url' and nullif(trim(p ->> 'source_url'), '') is null then
        raise exception 'Une recette importée depuis un lien doit garder l''adresse de sa source' using errcode = 'P0001';
      end if;
    end if;
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
      v_origin,
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
      -- Le lien vers la source d'une recette importée peut être corrigé, pas effacé.
      source_url = case when v_existing.origin = 'import_url'
                        then coalesce(nullif(trim(p ->> 'source_url'), ''), v_existing.source_url)
                        else nullif(trim(p ->> 'source_url'), '') end,
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

revoke execute on function public.save_recipe(jsonb) from public, anon;
grant execute on function public.save_recipe(jsonb) to authenticated;
