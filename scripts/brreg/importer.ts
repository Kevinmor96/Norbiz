// Importøren: utvider et kommunedatasett med det som ble hentet fra Brreg.
//
// Modulen er ren. Samme datasett og samme øyeblikksbilde gir samme resultat,
// og resultatet kjørt en gang til på det samme bildet gir det samme igjen
// (idempotent). Ingen klokke, ingen tilfeldighet, ingen filsystem.
//
// EIERSKAP TIL RADENE. En rad er importørens når belegget er `verifisert` fra
// en av Brreg-kildene og merknaden ikke begynner med «Bekrefter grunnlaget».
// Slike rader bygges på nytt ved hver kjøring. Alt annet er grunnlaget
// (håndsammenstilt fra researchgrunnlaget), og det endres bare på én måte:
// når registeret bekrefter en påstand, oppgraderes belegget til `verifisert`
// med hentedatoen, og merknaden begynner med «Bekrefter grunnlaget». Sier
// registeret noe annet, står grunnlagets påstand urørt, registerets påstand
// legges til ved siden av, og begge går til avviksrapporten.
//
// PERSONER. Bare `key` og `navn`. To registerpersoner er samme person når
// navn og fødselsdato gir samme hash (`pid`). En registerperson er samme som
// en person i grunnlaget bare når de deler organ og navn (samme rolle, eller
// en annen rolle i samme organ). Navnet alene er aldri nok. Hashsuffikset i
// nøkkelen brukes bare når to personer ellers ville fått samme nøkkel.

import type {
  Avvik as _Ubrukt,
  Belegg,
  Hull,
  Kilde,
  Kommunedatasett,
  Nokkeltall,
  Nokkeltalltype,
  Organisasjon,
  OrgSegment,
  Organtype,
  Person,
  Relasjon,
  Rolleinnehav,
  Rolletype,
} from "./typer";
import type { Enhet, Naering, Oyeblikksbilde, Rolle, Rollekode, Underenhet } from "./hent";
import type { Felleskonfig, Kommunekonfig, OrgformRegel, Tabeller } from "./konfig";
import { segmentFor } from "./konfig";
import { fold, navnKanVaereSamme, orgNavnNokkel, pentOrgNavn, sammeNavn, slug } from "./tekst";
import { nokkel } from "../../src/lib/data/samle";

type _ = _Ubrukt;
