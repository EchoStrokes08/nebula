-- F03-011 — Eliminar la cuenta fallaba para todo el mundo.
--
-- `challenge_results` está en la publicación `supabase_realtime` y no tenía clave primaria, así
-- que Postgres rechazaba cualquier UPDATE sobre ella: «cannot update table "challenge_results"
-- because it does not have a replica identity and publishes updates». Al borrar un usuario, la
-- cascada `on delete set null` de `challenge_results.user_id` lanza ese UPDATE (aunque no haya
-- filas) y aborta el borrado entero. Una clave primaria le da identidad de réplica.
alter table public.challenge_results add column id uuid not null default gen_random_uuid();
alter table public.challenge_results add constraint challenge_results_pkey primary key (id);
