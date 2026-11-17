-- Nebula · F03-007 — Objetivos declarados en el onboarding.
-- Son intenciones en texto libre que luego el usuario puede convertir en metas reales (F05).
alter table public.user_preferences
  add column onboarding_goals text[] not null default '{}',
  add constraint user_preferences_onboarding_goals_size check (cardinality(onboarding_goals) <= 10);
