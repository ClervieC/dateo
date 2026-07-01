-- Table pour les favoris/marque-pages du feed
create table if not exists date_favorites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  date_id uuid references dates(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(user_id, date_id)
);

alter table date_favorites enable row level security;

create policy "favorites_own" on date_favorites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
