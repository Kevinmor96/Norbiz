-- Artikler: bloggen som bærer langhale-SEO.
--
-- Kategorisidene vinner søkene som matcher en kategori. Artiklene finnes for
-- resten av langhalen — «hvorfor har fysioterapi 56 % margin», «hvilke bransjer
-- vokser i Norge» — spørsmål et menneske googler, men som ingen enkeltside
-- svarer på.
--
-- SAMME FORANKRINGSDISIPLIN SOM ai_insights. Artiklene genereres av
-- `generate-artikkel`, som sender målte tall inn i prompten og validerer at
-- hvert tall modellen viser til faktisk ble sendt. `referanser` bærer
-- valideringssporet og `kilder` den leservendte kildelisten — en artikkel uten
-- kildeliste er en påstand, ikke en analyse. `model` og `prompt_version` står
-- på raden av samme grunn som i ai_insights: når prompten forbedres, skal
-- gamle artikler kunne finnes og regenereres.
--
-- RLS er asymmetrisk som i resten av basen: anon leser bare `status='publisert'`,
-- og ingen andre enn service-rollen skriver. `kladd` finnes for at en generert
-- artikkel skal kunne holdes tilbake ved gjennomlesning uten å slettes.
create table articles (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  tittel          text not null,
  ingress         text not null,
  brodtekst       text not null,
  seo_beskrivelse text not null,
  kategori_slug   text references categories (slug) on delete set null,
  status          text not null default 'publisert' check (status in ('kladd', 'publisert')),
  publisert_dato  date not null default current_date,
  referanser      jsonb not null,
  kilder          jsonb not null,
  model           text not null,
  prompt_version  text not null,
  opprettet       timestamptz not null default now(),
  constraint articles_slug_format check (slug ~ '^[a-z0-9-]+$'),
  constraint articles_referanser_ikke_tom check (jsonb_array_length(referanser) > 0),
  constraint articles_kilder_ikke_tom check (jsonb_array_length(kilder) > 0)
);

create index articles_publisert_idx on articles (publisert_dato desc) where status = 'publisert';
create index articles_kategori_idx on articles (kategori_slug);

alter table articles enable row level security;

create policy articles_les_publiserte on articles
  for select using (status = 'publisert');

grant select on articles to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on articles from anon, authenticated;

comment on table articles is
  'Genererte artikler forankret i målte tall. Skrives kun av generate-artikkel med service-rollen; anon leser bare publiserte.';
