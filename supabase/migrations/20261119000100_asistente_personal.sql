-- Contexto personal del asistente: lo escribe la propia persona y viaja con cada petición a la IA.
alter table public.user_preferences
  add column ai_about text not null default '' check (char_length(ai_about) <= 1500),
  add column ai_tone text not null default 'cercano' check (ai_tone in ('cercano', 'directo', 'motivador', 'tranquilo')),
  add column ai_share_journal boolean not null default false;
