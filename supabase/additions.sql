-- Objectif mensuel sur le profil
alter table profiles add column if not exists monthly_goal int default null;

-- Note du partenaire sur un date (mode couple collaboratif)
create table if not exists date_partner_ratings (
  id uuid default gen_random_uuid() primary key,
  date_id uuid references dates(id) on delete cascade not null,
  partner_id uuid references profiles(id) on delete cascade not null,
  note_globale int not null check (note_globale >= 0 and note_globale <= 20),
  commentaire text,
  created_at timestamptz default now() not null,
  unique(date_id, partner_id)
);
alter table date_partner_ratings enable row level security;
create policy "dpr_select" on date_partner_ratings for select using (
  partner_id = auth.uid() or
  date_id in (select id from dates where user_id = auth.uid())
);
create policy "dpr_insert" on date_partner_ratings for insert with check (partner_id = auth.uid());
create policy "dpr_update" on date_partner_ratings for update using (partner_id = auth.uid());
create policy "dpr_delete" on date_partner_ratings for delete using (partner_id = auth.uid());

-- Wishlist de lieux à tester
create table if not exists wishlist_lieux (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  nom text not null,
  adresse text,
  categorie text,
  note text,
  created_at timestamptz default now() not null
);
alter table wishlist_lieux enable row level security;
create policy "wishlist_own" on wishlist_lieux
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
