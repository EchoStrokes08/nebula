-- Distingue UTC por defecto de UTC elegido explícitamente por la persona.
alter table public.profiles add column timezone_confirmed boolean not null default false;
