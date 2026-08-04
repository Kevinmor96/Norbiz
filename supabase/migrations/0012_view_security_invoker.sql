-- Views kjører som eier (security definer) om ikke annet sies. Tabellene under
-- er offentlig lesbare via RLS, så eksponeringen var liten — men invoker-retter
-- er riktig modell: viewet skal aldri vise mer enn spørreren selv får se.
-- Supabase-linteren flagger eier-views som ERROR, og testen i
-- tests/aggregates.test.ts håndhever nå invoker-retter på alle views i public.
alter view score_raw set (security_invoker = true);
alter view score_long set (security_invoker = true);
alter view score_long_pct set (security_invoker = true);
alter view industry_scores_computed set (security_invoker = true);
