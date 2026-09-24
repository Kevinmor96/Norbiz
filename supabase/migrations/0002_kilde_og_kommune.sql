-- Kilder og kommuner.
--
-- Hver påstand i basen peker på en kilde. Kildetypen er rangert etter tillit
-- (register først), og regelen i sjekk_belegg() under bygger på den.

create table kilde (
  id uuid primary key,
  key text not null unique check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  navn text not null check (length(navn) between 1 and 300),
  url text check (url ~ '^https?://'),
  type kildetype not null,
  lisens text,
  constraint kilde_id_fra_key check (id = intern.nokkel_id('kilde', key))
);

comment on table kilde is
  'Kildene påstandene bygger på. id er avledet av key (nokkel_id), så seed-en er deterministisk.';

-- Én rad per kommunedatasett (src/data/<slug>.json).
--
-- id avledes av slug, ikke av kommunenummeret. Et kommunenummer er ikke en
-- konstant: 3801 og 1507 ble 3905 og 1508 i 2024. Da skal kommunen beholde
-- id-en sin og få nytt nummer.
create table kommune (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kommunenr text not null unique check (kommunenr ~ '^\d{4}$'),
  navn text not null,
  fylkesnr text not null check (fylkesnr ~ '^\d{2}$'),
  fylke text not null,
  sammenstilt date not null,
  grunnlag text not null,
  merknad text not null,
  constraint kommune_id_fra_slug check (id = intern.nokkel_id('kommune', slug))
);

comment on table kommune is
  'Kommunedatasettene. RPC-ene tar kommunenummer, men id følger slug fordi nummeret kan endres.';

-- Felles regel for alle påstandstabeller (de med kilde_id og verifisering):
--
-- Proff, Purehelp og andre videreformidlere av registerdata (kildetype
-- `sekundaer`) er aldri mer enn `maa_verifiseres`. Grunnlaget sier selv at
-- tallene skal sjekkes mot registeret. Regelen står her, i basen, fordi
-- pipelinen og seed-en begge skriver påstander.
--
-- At `verifisert` krever tidsstempel, er en check-constraint på hver tabell.
create function intern.sjekk_belegg() returns trigger
language plpgsql
set search_path = public, intern
as $$
begin
  if new.verifisering <> 'maa_verifiseres'
     and (select k.type from kilde k where k.id = new.kilde_id) = 'sekundaer' then
    raise exception 'Påstand % i % bygger på en sekundærkilde og må være maa_verifiseres', new.key, tg_table_name
      using errcode = 'check_violation', constraint = tg_table_name || '_sekundaerkilde';
  end if;
  return new;
end
$$;
