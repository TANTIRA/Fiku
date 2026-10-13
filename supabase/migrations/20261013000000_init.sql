-- Fuku: ledger (system of record). The ontology projection lives in TypeDB.

create type public.tx_kind as enum ('income', 'expense');
create type public.necessity as enum ('kebutuhan', 'keinginan', 'tabungan');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind public.tx_kind not null,
  parent_id uuid references public.categories (id) on delete set null,
  -- Only set on top-level categories; children inherit it through the ontology.
  necessity public.necessity,
  keywords text[] not null default '{}',
  icon text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, name)
);

create index categories_user_idx on public.categories (user_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.tx_kind not null,
  amount bigint not null check (amount > 0 and amount < 1000000000000),
  category_id uuid references public.categories (id) on delete set null,
  description text not null check (char_length(description) between 1 and 200),
  counterparty text check (char_length(counterparty) <= 100),
  occurred_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'assistant')),
  ontology_synced boolean not null default false,
  created_at timestamptz not null default now()
);

create index transactions_user_time_idx on public.transactions (user_id, occurred_at desc);
create index transactions_unsynced_idx on public.transactions (user_id) where not ontology_synced;

alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy "own categories" on public.categories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own transactions" on public.transactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and c.user_id = (select auth.uid()) and c.kind = transactions.kind
      )
    )
  );

-- Default category tree for every new user.
create or replace function public.seed_default_categories(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pokok uuid;
  gaya uuid;
  tabung uuid;
begin
  insert into public.categories (user_id, name, kind, necessity, icon)
    values (uid, 'Kebutuhan Pokok', 'expense', 'kebutuhan', '🏠') returning id into pokok;
  insert into public.categories (user_id, name, kind, necessity, icon)
    values (uid, 'Gaya Hidup', 'expense', 'keinginan', '🎉') returning id into gaya;
  insert into public.categories (user_id, name, kind, necessity, icon)
    values (uid, 'Tabungan & Investasi', 'expense', 'tabungan', '🐷') returning id into tabung;

  insert into public.categories (user_id, name, kind, parent_id, icon, keywords) values
    (uid, 'Makanan & Minuman', 'expense', pokok, '🍚', array['makan','makanan','nasi','sarapan','lauk','warteg','padang','bakso','mie','ayam','minum','air','galon','catering']),
    (uid, 'Belanja Harian', 'expense', pokok, '🛒', array['belanja','sayur','pasar','indomaret','alfamart','supermarket','sabun','beras','minyak','telur','gas','elpiji','sembako']),
    (uid, 'Transportasi', 'expense', pokok, '🛵', array['bensin','pertalite','pertamax','parkir','tol','ojek','gojek','grab','gocar','grabcar','taksi','kereta','krl','mrt','busway','transjakarta','bus','tiket','servis','motor','mobil']),
    (uid, 'Tagihan & Utilitas', 'expense', pokok, '💡', array['listrik','pln','token','pdam','air pam','internet','wifi','indihome','pulsa','kuota','paket data','bpjs','iuran','tagihan']),
    (uid, 'Tempat Tinggal', 'expense', pokok, '🏘️', array['kos','kost','sewa','kontrakan','rumah','ipl','apartemen']),
    (uid, 'Kesehatan', 'expense', pokok, '💊', array['obat','apotek','dokter','klinik','rumah sakit','rs','vitamin','periksa']),
    (uid, 'Pendidikan', 'expense', pokok, '📚', array['sekolah','kuliah','spp','ukt','kursus','les','buku']),
    (uid, 'Cicilan & Utang', 'expense', pokok, '💳', array['cicilan','kredit','utang','hutang','paylater','kartu kredit','angsuran','pinjaman']),
    (uid, 'Jajan & Kopi', 'expense', gaya, '☕', array['kopi','coffee','starbucks','jajan','snack','boba','es teh','martabak','gorengan','cemilan','dessert']),
    (uid, 'Makan di Luar', 'expense', gaya, '🍣', array['resto','restoran','cafe','kafe','gofood','grabfood','shopeefood','mcd','kfc','pizza','sushi','nongkrong','traktir']),
    (uid, 'Hiburan', 'expense', gaya, '🎬', array['bioskop','nonton','film','konser','game','topup','top up','karaoke','main']),
    (uid, 'Langganan', 'expense', gaya, '📺', array['netflix','spotify','youtube premium','disney','langganan','subscription','icloud','google one','chatgpt']),
    (uid, 'Belanja Pribadi', 'expense', gaya, '🛍️', array['baju','sepatu','celana','tas','shopee','tokopedia','lazada','skincare','kosmetik','gadget','hp']),
    (uid, 'Liburan', 'expense', gaya, '✈️', array['liburan','hotel','pesawat','traveling','wisata','staycation']),
    (uid, 'Hadiah & Donasi', 'expense', gaya, '🎁', array['hadiah','kado','donasi','sedekah','zakat','infaq','sumbangan','kondangan','amplop']),
    (uid, 'Lainnya', 'expense', gaya, '📦', array[]::text[]),
    (uid, 'Tabungan', 'expense', tabung, '🏦', array['tabung','nabung','tabungan','dana darurat','deposito']),
    (uid, 'Investasi', 'expense', tabung, '📈', array['investasi','saham','reksadana','reksa dana','emas','crypto','kripto','obligasi','sbn']);

  insert into public.categories (user_id, name, kind, icon, keywords) values
    (uid, 'Gaji', 'income', '💼', array['gaji','gajian','salary','upah','honor']),
    (uid, 'Bonus & THR', 'income', '🎊', array['bonus','thr','insentif','komisi']),
    (uid, 'Usaha & Freelance', 'income', '🧑‍💻', array['freelance','proyek','project','jualan','penjualan','jual','usaha','klien','client','order']),
    (uid, 'Hasil Investasi', 'income', '💹', array['dividen','bunga','profit','cuan','return']),
    (uid, 'Hadiah & Kiriman', 'income', '🎁', array['dikasih','kiriman','transferan','hadiah','angpao','uang saku','jajan dari']),
    (uid, 'Pemasukan Lain', 'income', '💰', array['refund','cashback','kembalian','reimburse']);
end;
$$;

revoke all on function public.seed_default_categories(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
