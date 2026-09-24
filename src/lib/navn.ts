// Navnene leseren ser på verdiene i datakontrakten. Én liste, så «innstilling»
// heter det samme i kjeden, organkartet og bransjematrisen.

import type { Hendelsestype, Myndighet, Nivaa, Nokkeltalltype, Organtype } from "@/lib/data";

export const NIVAANAVN: Record<Nivaa, string> = {
  stat: "Stat",
  fylke: "Fylke",
  kommune: "Kommune",
  interkommunal: "Interkommunalt",
  samisk: "Samisk",
  privat: "Selskap",
  interesse: "Interesseorganisasjon",
  mellomstatlig: "Mellomstatlig",
};

export const MYNDIGHETNAVN: Record<Myndighet, string> = {
  vedtak: "Vedtak",
  regelverk: "Regelverk",
  tilsyn: "Tilsyn",
  konsesjon: "Konsesjon",
  klage: "Klage",
  finansiering: "Finansiering",
  innkjop: "Innkjøp",
  eierskap: "Eierskap",
  planmyndighet: "Planmyndighet",
  innstilling: "Innstilling",
  raadgivning: "Rådgivning",
  lobby: "Lobby",
};

export const ORGANTYPENAVN: Record<Organtype, string> = {
  kommune: "Kommune",
  fylkeskommune: "Fylkeskommune",
  folkevalgt_organ: "Folkevalgt organ",
  utvalg: "Utvalg",
  raad: "Råd",
  administrasjon: "Administrasjon",
  departement: "Departement",
  direktorat: "Direktorat",
  etat: "Etat",
  statsforvalter: "Statsforvalter",
  domstol: "Domstol",
  paatale: "Påtalemyndighet",
  politi: "Politi",
  tilsyn: "Tilsyn",
  nemnd: "Nemnd",
  lovgivende: "Lovgivende",
  KF: "Kommunalt foretak",
  FKF: "Fylkeskommunalt foretak",
  AS: "Aksjeselskap",
  ASA: "Allmennaksjeselskap",
  IKS: "Interkommunalt selskap",
  SA: "Samvirkeforetak",
  sparebank: "Sparebank",
  stiftelse: "Stiftelse",
  HF: "Helseforetak",
  RHF: "Regionalt helseforetak",
  universitet: "Universitet",
  forskning: "Forskningsinstitutt",
  forening: "Forening",
  samarbeid: "Samarbeid",
  saerlovselskap: "Særlovselskap",
};

export const HENDELSESTYPENAVN: Record<Hendelsestype, string> = {
  rollebytte: "Rollebytte",
  opprettet: "Opprettet",
  nedlagt: "Nedlagt",
  splittet: "Delt",
  sammenslatt: "Sammenslått",
  vedtak: "Vedtak",
  valg: "Valg",
  utbytte: "Utbytte",
  regnskap: "Regnskap",
  strukturdebatt: "Foreslått",
  planlagt: "Planlagt",
};

export const NOKKELTALLNAVN: Record<Nokkeltalltype, string> = {
  omsetning: "Omsetning",
  driftsresultat: "Driftsresultat",
  aarsresultat: "Årsresultat",
  resultat_for_skatt: "Resultat før skatt",
  egenkapital: "Egenkapital",
  utbytte: "Utbytte",
  omsatt_verdi: "Omsatt verdi",
  merforbruk: "Merforbruk",
  underskudd: "Underskudd",
  aarsverk: "Årsverk",
};
