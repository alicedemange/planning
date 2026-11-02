-- =====================================================================
--  Planning réseaux Cha'mania : création de la base Supabase
--  À coller en entier dans Supabase > SQL Editor > New query, puis "Run".
--  Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- =====================================================================

-- ---------- 1. Profils de l'équipe (un par compte) ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text,
  display_name  text,
  color         text not null default '#f75b95',
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Crée automatiquement le profil quand tu ajoutes un compte dans Supabase.
-- Prénom affiché = début de l'identifiant ("lea@chamania.local" -> "Lea"), modifiable ensuite dans l'appli.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  palette text[] := array['#f75b95','#31bbbb','#f2b134','#7d6bb0','#1d7f7f','#b8336a','#e0703a','#5a8f3c'];
  n int;
begin
  select count(*) into n from public.profiles;
  insert into public.profiles (id, username, display_name, color, is_admin)
  values (
    new.id,
    split_part(new.email, '@', 1),
    initcap(replace(split_part(new.email, '@', 1), '.', ' ')),
    palette[(n % 8) + 1],
    n = 0            -- le tout premier compte créé devient administratrice
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rattrape les comptes créés avant ce script
insert into public.profiles (id, username, display_name)
select u.id, split_part(u.email,'@',1), initcap(replace(split_part(u.email,'@',1),'.',' '))
from auth.users u
on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------- 2. Posts ----------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  status      text not null default 'creation' check (status in ('idee','creation','pret','publie')),
  rubrique    text not null default 'autre',
  platforms   text[] not null default array['instagram','facebook'],
  format      text not null default 'post',
  date        date,
  time        text,
  assignee    uuid references public.profiles(id) on delete set null,
  caption     text not null default '',
  hashtags    text not null default '',
  notes       text not null default '',
  link        text not null default '',
  media       jsonb not null default '[]'::jsonb,
  published   jsonb not null default '{}'::jsonb,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists posts_date_idx on public.posts(date);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

-- Coche / décoche "publié" sur un réseau sans écraser ce que coche une autre personne au même moment
create or replace function public.set_published(p_post uuid, p_platform text, p_url text default null, p_unset boolean default false)
returns void language plpgsql security invoker set search_path = public as $$
declare pub jsonb; pfs text[];
begin
  if p_unset then
    update posts set published = published - p_platform, status = 'pret' where id = p_post;
    return;
  end if;
  update posts
     set published = jsonb_set(published, array[p_platform],
           coalesce(published -> p_platform, jsonb_build_object('at', now(), 'by', auth.uid()))
           || case when p_url is null then '{}'::jsonb else jsonb_build_object('url', p_url) end, true)
   where id = p_post
   returning published, platforms into pub, pfs;
  if pfs is not null and array_length(pfs,1) > 0
     and not exists (select 1 from unnest(pfs) k where not (pub ? k)) then
    update posts set status = 'publie' where id = p_post and status = 'pret';
  end if;
end $$;

-- ---------- 3. Messages sur les posts ----------
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  author      uuid references public.profiles(id) on delete set null default auth.uid(),
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments(post_id);

-- ---------- 4. Sécurité : seules les personnes connectées (comptes créés par toi) ont accès ----------
alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.comments enable row level security;

drop policy if exists "equipe lit les profils" on public.profiles;
create policy "equipe lit les profils" on public.profiles for select to authenticated using (true);
drop policy if exists "chacune modifie son profil" on public.profiles;
create policy "chacune modifie son profil" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists "equipe gere les posts" on public.posts;
create policy "equipe gere les posts" on public.posts for all to authenticated using (true) with check (true);

drop policy if exists "equipe lit les messages" on public.comments;
create policy "equipe lit les messages" on public.comments for select to authenticated using (true);
drop policy if exists "equipe ecrit des messages" on public.comments;
create policy "equipe ecrit des messages" on public.comments for insert to authenticated with check (author = auth.uid());
drop policy if exists "chacune supprime ses messages" on public.comments;
create policy "chacune supprime ses messages" on public.comments for delete to authenticated using (author = auth.uid() or public.is_admin());

-- Empêche une non-admin de se donner le rôle admin
create or replace function public.protect_admin_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_admin on public.profiles;
create trigger profiles_protect_admin before update on public.profiles
  for each row execute function public.protect_admin_flag();

-- ---------- 5. Stockage des visuels ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medias', 'medias', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "equipe envoie des visuels" on storage.objects;
create policy "equipe envoie des visuels" on storage.objects for insert to authenticated with check (bucket_id = 'medias');
drop policy if exists "equipe modifie des visuels" on storage.objects;
create policy "equipe modifie des visuels" on storage.objects for update to authenticated using (bucket_id = 'medias');
drop policy if exists "equipe supprime des visuels" on storage.objects;
create policy "equipe supprime des visuels" on storage.objects for delete to authenticated using (bucket_id = 'medias');

-- ---------- 6. Mises à jour en direct ----------
do $$ begin
  begin alter publication supabase_realtime add table public.posts;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;

-- ---------- 7. "Ping" utilisé par la tâche GitHub pour éviter la mise en pause ----------
create or replace function public.ping()
returns text language sql security definer set search_path = public as $$
  select 'ok ' || now()::text || ' · ' || (select count(*) from public.posts)::text || ' posts';
$$;
grant execute on function public.ping() to anon, authenticated;
