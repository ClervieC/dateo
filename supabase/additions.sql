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

-- Participants d'un date (au-delà du couple : amis invités, plusieurs personnes possibles)
create table if not exists date_participants (
  id uuid default gen_random_uuid() primary key,
  date_id uuid references dates(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(date_id, user_id)
);
alter table date_participants enable row level security;
create policy "dp_select" on date_participants for select using (
  user_id = auth.uid() or
  date_id in (select id from dates where user_id = auth.uid())
);
create policy "dp_insert" on date_participants for insert with check (
  date_id in (select id from dates where user_id = auth.uid())
);
create policy "dp_delete" on date_participants for delete using (
  date_id in (select id from dates where user_id = auth.uid())
);

-- Date de mise en couple : sert à pré-sélectionner automatiquement le/la partenaire
-- comme participant lors de la notation d'un date survenu après cette date.
alter table couples add column if not exists date_debut date default null;

-- Ville de l'utilisateur (GPS par défaut ou saisie manuelle) : sert à filtrer les idées
-- de dates et à contextualiser les prompts envoyés à l'IA.
alter table profiles add column if not exists ville text default null;

-- Ville associée à une idée de date (nulle = idée générique, visible partout).
alter table date_ideas add column if not exists ville text default null;

-- Unification des catégories : les idées de dates utilisaient un vocabulaire différent
-- (Nature/Gastronomie/Culture/Aventure/Cocooning/IA) de celui des dates notés
-- (restaurant/cine/nature/culture/sport/balade/soiree/voyage/autre). On normalise les
-- valeurs existantes vers les mêmes clés, pour que dates et idées restent comparables.
-- Cocooning et IA n'ont pas d'équivalent clair : rangés dans "autre".
-- La contrainte NOT NULL est assouplie par précaution (ex: idées générées par l'IA
-- dont la catégorie n'a pas pu être déterminée).
alter table date_ideas alter column categorie drop not null;
update date_ideas set categorie = 'nature' where categorie = 'Nature';
update date_ideas set categorie = 'restaurant' where categorie = 'Gastronomie';
update date_ideas set categorie = 'culture' where categorie = 'Culture';
update date_ideas set categorie = 'sport' where categorie = 'Aventure';
update date_ideas set categorie = 'autre' where categorie in ('Cocooning', 'IA');
