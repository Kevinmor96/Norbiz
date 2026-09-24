-- Funksjonene i 0015/0017 manglet fast search_path. Uten den slår
-- funksjonskroppen opp tabellnavn i den search_path kalleren har satt, og en
-- rolle som kan lage tabeller kan da skyve inn egne `categories` eller
-- `companies` foran våre. Funksjonene er ikke security definer, så gevinsten
-- for en angriper er begrenset — men et fast oppslag er riktig uansett, og
-- Supabase-linteren flagger det.
--
-- Funksjonene i migrasjon 0010 setter `search_path = public` i definisjonen;
-- disse fire ble skrevet uten, og får det her.
alter function kategori_oversikt() set search_path = public;
alter function topp_selskaper(text, text, text, int) set search_path = public;
alter function kategori_rangering(text, text, int) set search_path = public;
alter function brand_liste(text) set search_path = public;
