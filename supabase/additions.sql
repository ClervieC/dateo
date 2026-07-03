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

-- Réponses aux commentaires : parent_id pointe vers le commentaire auquel on répond.
-- null = commentaire de premier niveau.
alter table date_comments add column if not exists parent_id uuid references date_comments(id) on delete cascade;

-- Sécurité : le token push est un secret d'appareil, pas une donnée de profil public.
-- RLS ne filtre pas par colonne, donc même une policy "select using (true)" sur
-- profiles exposerait ce token à tout utilisateur connecté qui lit un profil. On
-- verrouille donc l'accès à la colonne elle-même : seul le service_role (utilisé par
-- les edge functions notify-*) peut encore la lire ; l'app cliente ne doit plus jamais
-- faire de .select('expo_push_token') sur un autre utilisateur que soi-même.
revoke select (expo_push_token) on profiles from authenticated;
revoke select (expo_push_token) on profiles from anon;

-- Consentement CGU/politique de confidentialité (écran /consent), horodaté pour preuve.
alter table profiles add column if not exists terms_accepted_at timestamptz default null;

-- Date de naissance, utilisée uniquement pour vérifier l'âge minimum à l'inscription
-- (16 ans, seuil de consentement RGPD pour le traitement de données par un mineur).
alter table profiles add column if not exists date_naissance date default null;

-- Blocage d'utilisateurs : masque leur contenu (feed, recherche, invitations) et les
-- empêche d'interagir. Asymétrique (A bloque B n'implique pas que B bloque A), donc
-- une table dédiée plutôt qu'un statut sur "friends" qui mélangerait les deux notions.
create table if not exists user_blocks (
  id uuid default gen_random_uuid() primary key,
  blocker_id uuid references profiles(id) on delete cascade not null,
  blocked_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(blocker_id, blocked_id)
);
alter table user_blocks enable row level security;
create policy "blocks_select_own" on user_blocks for select using (auth.uid() = blocker_id);
create policy "blocks_insert_own" on user_blocks for insert with check (auth.uid() = blocker_id);
create policy "blocks_delete_own" on user_blocks for delete using (auth.uid() = blocker_id);

-- Signalements de profils, pour modération manuelle (via le SQL editor / dashboard).
-- Un utilisateur ne peut créer et lire que ses propres signalements ; la lecture pour
-- modération se fait avec le service_role, en dehors de l'app cliente.
create table if not exists user_reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references profiles(id) on delete cascade not null,
  reported_id uuid references profiles(id) on delete cascade not null,
  reason text not null,
  context text,
  created_at timestamptz default now() not null
);
alter table user_reports enable row level security;
create policy "reports_insert_own" on user_reports for insert with check (auth.uid() = reporter_id);
create policy "reports_select_own" on user_reports for select using (auth.uid() = reporter_id);

-- Rate limiting basique pour les edge functions exposées aux utilisateurs authentifiés
-- (notify-comment, notify-reaction, notify-social) : empêche un compte de déclencher
-- un flot de notifications en boucle. Compteur par (user_id, fonction) remis à zéro
-- toutes les minutes côté fonction (voir lib/rateLimit.ts dans supabase/functions/_shared).
create table if not exists rate_limits (
  key text primary key,
  count int not null default 1,
  window_start timestamptz not null default now()
);
alter table rate_limits enable row level security;
-- Aucune policy select/insert/update pour les rôles anon/authenticated : uniquement
-- accessible via le service_role utilisé par les edge functions.
