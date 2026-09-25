-- Supabase har `alter default privileges` som gir anon og authenticated
-- ARWDXT — altså alle rettigheter — på hver nye tabell i public. Verifisert i
-- pg_default_acl på livebasen: nye tabeller arver
-- `anon=arwdDxtm/postgres`.
--
-- I praksis har radnivåsikkerheten holdt dem ute: uten en policy for insert,
-- update eller delete avvises skrivingen uansett hva granten sier. Men det er
-- ett lag, og det laget er en policy-liste som vokser. Legger noen til en
-- permissive policy for å løse et helt annet problem, står skrivingen åpen —
-- og granten som tillater det er usynlig i policy-oversikten.
--
-- Denne migrasjonen fjerner rettighetene som ikke skal brukes, slik at
-- tabellene også ville tålt en feilaktig policy:
--
--   Statistikk- og redaksjonstabeller  anon/authenticated leser, skriver aldri.
--                                      Import og seed går med service-role.
--   newsletter_signups                 anon/authenticated skriver, leser aldri.
--   favorites                          authenticated leser/skriver sine egne.
--
-- Merk at revoke ikke endrer default privileges: neste nye tabell arver de
-- samme brede rettighetene igjen. Det er en oppgave for prosjektoppsettet,
-- ikke for en migrasjon — men en ny tabell skal uansett få eksplisitte
-- grants her, og da er det synlig hva den faktisk tilbyr.
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      and c.relname not in ('favorites', 'newsletter_signups')
    order by 1
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on %I from anon, authenticated', t);
  end loop;
end $$;

-- Nyhetsbrevlista: skrivbar, aldri lesbar. Dette er den ene tabellen i basen
-- som ikke inneholder allerede publisert offentlig informasjon.
revoke select, update, delete, truncate, references, trigger
  on newsletter_signups from anon, authenticated;
grant insert on newsletter_signups to anon, authenticated;

-- Favoritter er brukereide. authenticated trenger select/insert/delete, og
-- RLS avgrenser til egne rader; anon skal ikke ha noe.
revoke all on favorites from anon;
revoke update, truncate, references, trigger on favorites from authenticated;
grant select, insert, delete on favorites to authenticated;
