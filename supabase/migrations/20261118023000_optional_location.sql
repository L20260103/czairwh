alter table public.materials drop constraint materials_location_len;
alter table public.materials alter column location set default '';
alter table public.materials add constraint materials_location_len check (char_length(location) <= 40);
update public.materials set location = '' where location = '待定';
