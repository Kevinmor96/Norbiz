// Organprofilen: det skuffen og organsiden viser (DESIGN.md §5.3, spec §2).
// Myndighet, roller nå og før, eierskap begge veier, nøkkeltall med år og
// morselskap eller konsern, plassen i organisasjonen, hendelser, bransjer,
// det vi ikke vet og kildene.
//
// Samme innhold i skuffen og på /organ/$key, så de aldri sier forskjellige
// ting. Skuffen er Operere-modus (DESIGN.md): skanbar, tette rader, én linje
// per påstand, kildemerket bundet til påstanden.
//
// Lenker til andre organer går gjennom OrganLenke. På kommunesiden åpner de
// organet i skuffen. På organsiden, der skuffen ikke finnes, går de til
// organets egen side.

import { ArrowUpRight } from "lucide-react";
import { useId, type ReactNode } from "react";

import { Kildemerke, MedMerke, Pastand } from "@/components/maktkart/kildemerke";
import { KILDETYPER } from "@/lib/belegg";
import type { Eierandel, Endring, KildeUt, OrganProfil, OrganRef, Rolle } from "@/lib/data";
import { dato, datoKort, datoStor, kroner, orgnr, prosent, splittSisteOrd, tall } from "@/lib/format";
import { HENDELSESTYPENAVN, NIVAANAVN, NOKKELTALLNAVN, ORGANTYPENAVN } from "@/lib/navn";
import { cn } from "@/lib/utils";

import {
  HarIkkeSkjedd,
  IkkeKartlagt,
  KildeneUenige,
  MyndighetListe,
  Planlagt,
  Sensitivmerke,
  Statusmerke,
  STYRKE,
} from "./merker";
import { OrganLenke } from "./organ-lenke";
import {
  erForeslatt,
  erForetak,
  erKonflikt,
  erLederrolle,
  konsernmerke,
  lederHentesFra,
  nokkelverdi,
  regnskapsperiode,
  RELASJONSNAVN,
  REGNSKAPSTYPER,
  ren,
  rollePastand,
  rolleTid,
} from "./tekst";

type Overskrift = "h2" | "h3";

/** «Kommune · Utvalg». Linjen over navnet i skuffen og på organsiden. */
export function nivaalinje(o: Pick<OrganRef, "nivaa" | "organtype">): string {
  return `${NIVAANAVN[o.nivaa]} · ${ORGANTYPENAVN[o.organtype]}`;
}

/** Den ene setningen organsiden og delingskortet bruker om organet. */
export function profilbeskrivelse(p: OrganProfil, sammenstilt: string | null): string {
  const leder = p.roller.naa.find(erLederrolle);
  const deler = [
    ren(p.organ.beskrivelse).trim(),
    leder ? `${leder.tittel}: ${leder.person.navn}.` : "",
    sammenstilt ? `Sammenstilt ${datoKort(sammenstilt)}, ikke etterprøvd mot Brreg.` : "",
  ];
  return deler.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Byggesteiner
// ---------------------------------------------------------------------------

function Del({
  tittel,
  overskrift: H,
  children,
  className,
}: {
  tittel: string;
  overskrift: Overskrift;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn("border-t border-linje py-5 first:border-t-0 first:pt-1", className)}
    >
      <H id={id} className="region mb-3 text-[0.6875rem] text-dempet">
        {tittel}
      </H>
      {children}
    </section>
  );
}

function Underoverskrift({ children }: { children: ReactNode }) {
  return <p className="mt-4 mb-1 text-[0.8125rem] font-semibold first:mt-0">{children}</p>;
}

/** En rad i en liste: påstand til venstre, verdi til høyre. */
function Rad({ children, verdi }: { children: ReactNode; verdi?: ReactNode }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 border-t border-linje py-2.5 first:border-t-0">
      <div className="min-w-0">{children}</div>
      {verdi !== undefined && (
        <div className="text-right font-semibold whitespace-nowrap tabular-nums">{verdi}</div>
      )}
    </li>
  );
}

function Tom({ children }: { children: ReactNode }) {
  return <p className="text-[0.875rem] leading-[1.45] text-dempet">{children}</p>;
}

/** Organnavn som lenke. I skuffen åpner den organet der, ellers organsiden. */
function Organnavn({ org, className }: { org: OrganRef; className?: string }) {
  return (
    <OrganLenke
      org={org.key}
      navn={org.navn}
      className={cn(
        "font-semibold underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal",
        className,
      )}
    >
      {org.navn}
    </OrganLenke>
  );
}

// ---------------------------------------------------------------------------
// Delene
// ---------------------------------------------------------------------------

function Beskrivelse({ profil, overskrift }: { profil: OrganProfil; overskrift: Overskrift }) {
  const { organ } = profil;
  const tekst = ren(organ.beskrivelse).trim();
  const konflikter = profil.hull.filter(erKonflikt);
  return (
    <Del tittel="Hva organet bestemmer over" overskrift={overskrift}>
      {tekst ? (
        <p className="maal text-[1rem] leading-[1.5]">
          <Pastand tekst={tekst} belegg={organ.belegg} pastand={`${organ.navn}: ${tekst}`} />
        </p>
      ) : (
        <IkkeKartlagt>Beskrivelse ikke kartlagt</IkkeKartlagt>
      )}
      <MyndighetListe myndighet={organ.myndighet} organnavn={organ.navn} className="mt-3" />
      {organ.myndighet.includes("innstilling") && (
        <p className="mt-2 text-[0.8125rem] leading-[1.45] text-dempet">
          Innstilling er forberedende makt. Den som skriver saken, former vedtaket.
        </p>
      )}
      {konflikter.map((h) => (
        <div key={h.hva} className="mt-4 border border-kote bg-flate px-3.5 py-3">
          <KildeneUenige />
          <p className="mt-2 text-[0.9375rem] leading-[1.5]">{ren(h.hva)}</p>
          <p className="mt-1 text-[0.8125rem] leading-[1.45] text-kote-tekst">{ren(h.hvorfor)}</p>
        </div>
      ))}
      {organ.sensitiv && (
        <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.8125rem] leading-[1.45] text-dempet">
          <Sensitivmerke />
          <span>Domstoler, politi, påtale og Forsvaret vises bare med toppleder, og aldri i nettverket.</span>
        </p>
      )}
    </Del>
  );
}

function Rollerad({ rolle, organnavn }: { rolle: Rolle; organnavn: string }) {
  const tid = rolleTid(rolle);
  const pastand = rollePastand(rolle, organnavn);
  return (
    <Rad>
      <p className="leading-[1.35]">
        {rolle.parti ? (
          <>
            <span className="font-semibold">{rolle.person.navn}</span>{" "}
            <MedMerke belegg={rolle.belegg} pastand={pastand} className="text-dempet">
              ({rolle.parti})
            </MedMerke>
          </>
        ) : (
          <Pastand
            tekst={rolle.person.navn}
            belegg={rolle.belegg}
            pastand={pastand}
            className="font-semibold"
          />
        )}{" "}
        <Statusmerke status={rolle.status} />
      </p>
      <p className="mt-0.5 text-[0.8125rem] leading-[1.4] text-dempet">
        {rolle.tittel}
        {tid.tekst && `, ${tid.tekst}`}
        {tid.planlagt && (
          <>
            {", "}
            <Planlagt>{tid.planlagt}</Planlagt>
          </>
        )}
      </p>
    </Rad>
  );
}

function Roller({ profil, overskrift }: { profil: OrganProfil; overskrift: Overskrift }) {
  const { organ, roller } = profil;
  const harLeder = roller.naa.some(erLederrolle);
  // Et stortingsbenk har representanter, ikke en leder. «Leder ikke kartlagt»
  // ville fått det til å se ut som noe mangler.
  const utenLeder = organ.organtype === "lovgivende";
  const hvor = lederHentesFra(profil.hull);
  return (
    <Del tittel="Roller" overskrift={overskrift}>
      <Underoverskrift>Nå</Underoverskrift>
      {!harLeder && !utenLeder && (
        <p className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <IkkeKartlagt>Leder ikke kartlagt</IkkeKartlagt>
          {hvor && <span className="text-[0.8125rem] text-dempet">Hentes fra {hvor}.</span>}
        </p>
      )}
      {roller.naa.length ? (
        <ul>
          {roller.naa.map((r) => (
            <Rollerad key={`${r.person.key}|${r.tittel}`} rolle={r} organnavn={organ.navn} />
          ))}
        </ul>
      ) : (
        <Tom>Datasettet navngir ingen i organet ennå.</Tom>
      )}
      <Underoverskrift>Før</Underoverskrift>
      {roller.tidligere.length ? (
        <ul>
          {roller.tidligere.map((r) => (
            <Rollerad
              key={`${r.person.key}|${r.tittel}|${r.til}`}
              rolle={r}
              organnavn={organ.navn}
            />
          ))}
        </ul>
      ) : (
        <Tom>Tidligere rolleinnehavere er ikke kartlagt.</Tom>
      )}
    </Del>
  );
}

function Eierrad({
  e,
  pastand,
  foretak,
}: {
  e: Eierandel;
  pastand: string;
  /** Et kommunalt foretak er en del av kommunen. Da vises ingen andel. */
  foretak?: boolean;
}) {
  const foreslatt = erForeslatt(e.belegg.merknad);
  const verdi = foretak ? (
    <MedMerke belegg={e.belegg} pastand={pastand} className="font-medium text-dempet">
      del av kommunen
    </MedMerke>
  ) : (
    <MedMerke belegg={e.belegg} pastand={pastand}>
      {e.andel !== null ? prosent(e.andel) : <span className="font-medium text-dempet">andel ikke oppgitt</span>}
    </MedMerke>
  );
  return (
    <Rad verdi={verdi}>
      <Organnavn org={e.org} />
      {e.belop_nok !== null && (
        <p className="mt-0.5 text-[0.8125rem] text-dempet">
          <span className="flyt">
            {kroner(e.belop_nok)} i utbytte{foreslatt ? ", foreslått" : ""}
          </span>
        </p>
      )}
    </Rad>
  );
}

function Eierskap({ profil, overskrift }: { profil: OrganProfil; overskrift: Overskrift }) {
  const { organ, eiere, eierandeler } = profil;
  const foretak = erForetak(organ.organtype);
  // Kommunens egne foretak står for seg. De er en del av kommunen, ikke en eierandel.
  const egneForetak = eierandeler.filter((e) => erForetak(e.org.organtype));
  const andeler = eierandeler.filter((e) => !erForetak(e.org.organtype));
  if (!eiere.length && !eierandeler.length) return null;
  return (
    <Del tittel="Eierskap" overskrift={overskrift}>
      {foretak && eiere.length > 0 && (
        <p className="mb-3 text-[0.875rem] leading-[1.45] text-dempet">
          Et kommunalt foretak er en del av kommunen og har ikke egne eiere. Relasjonen under er
          ikke en eierandel.
        </p>
      )}
      {eiere.length > 0 && (
        <>
          <Underoverskrift>{foretak ? "Del av" : "Eies av"}</Underoverskrift>
          <ul>
            {eiere.map((e) => (
              <Eierrad
                key={`${e.org.key}|${e.fra_dato}`}
                e={e}
                foretak={foretak}
                pastand={
                  foretak
                    ? `${organ.navn} er et foretak i ${e.org.navn}`
                    : `${e.org.navn} eier ${e.andel !== null ? prosent(e.andel) : "en andel"} av ${organ.navn}`
                }
              />
            ))}
          </ul>
        </>
      )}
      {andeler.length > 0 && (
        <>
          <Underoverskrift>Eier</Underoverskrift>
          <ul>
            {andeler.map((e) => (
              <Eierrad
                key={`${e.org.key}|${e.fra_dato}`}
                e={e}
                pastand={`${organ.navn} eier ${e.andel !== null ? prosent(e.andel) : "en andel"} av ${e.org.navn}`}
              />
            ))}
          </ul>
        </>
      )}
      {egneForetak.length > 0 && (
        <>
          <Underoverskrift>Kommunale foretak, del av kommunen</Underoverskrift>
          <ul>
            {egneForetak.map((e) => (
              <Eierrad
                key={`${e.org.key}|${e.fra_dato}`}
                e={e}
                foretak
                pastand={`${e.org.navn} er et foretak i ${organ.navn}`}
              />
            ))}
          </ul>
        </>
      )}
    </Del>
  );
}

function Nokkeltall({ profil, overskrift }: { profil: OrganProfil; overskrift: Overskrift }) {
  const { organ, nokkeltall } = profil;
  const leverer = REGNSKAPSTYPER.includes(organ.organtype) || erForetak(organ.organtype);
  if (!nokkeltall.length && !leverer) return null;
  return (
    <Del tittel="Nøkkeltall" overskrift={overskrift}>
      {nokkeltall.length ? (
        <ul>
          {nokkeltall.map((n) => {
            const periode = regnskapsperiode(n);
            const konsern = konsernmerke(n);
            const verdi = nokkelverdi(n);
            return (
              <Rad
                key={`${n.aar}|${n.periode}|${n.type}|${n.konsern}`}
                verdi={
                  <MedMerke
                    belegg={n.belegg}
                    pastand={`${NOKKELTALLNAVN[n.type]} for ${organ.navn} ${periode}${konsern ? `, ${konsern}` : ""}: ${verdi}`}
                  >
                    {verdi}
                  </MedMerke>
                }
              >
                <p className="leading-[1.35] font-semibold">{NOKKELTALLNAVN[n.type]}</p>
                <p className="mt-0.5 text-[0.8125rem] text-dempet">
                  {periode}
                  {konsern && `, ${konsern}`}
                </p>
              </Rad>
            );
          })}
        </ul>
      ) : (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <IkkeKartlagt>Ingen nøkkeltall med år</IkkeKartlagt>
          <span className="text-[0.8125rem] text-dempet">Hentes fra Regnskapsregisteret.</span>
        </p>
      )}
    </Del>
  );
}

function Plass({ profil, overskrift }: { profil: OrganProfil; overskrift: Overskrift }) {
  const { organ, overordnet, underordnede, relasjoner } = profil;
  // «Hører under» står alt som overordnet. Relasjonen med samme organ vises ikke to ganger.
  const iHierarki = new Set([overordnet?.key, ...underordnede.map((u) => u.key)]);
  const andre = relasjoner.filter((r) => !(r.type === "overordnet" && iHierarki.has(r.org.key)));
  const grupper = new Map<string, typeof andre>();
  for (const r of andre) {
    const navn = RELASJONSNAVN[r.type][r.retning];
    grupper.set(navn, [...(grupper.get(navn) ?? []), r]);
  }
  if (!overordnet && !underordnede.length && !andre.length) return null;
  return (
    <Del tittel="Plass og koblinger" overskrift={overskrift}>
      {overordnet && (
        <>
          <Underoverskrift>Hører under</Underoverskrift>
          <ul>
            <Rad>
              <Organnavn org={overordnet} />
            </Rad>
          </ul>
        </>
      )}
      {underordnede.length > 0 && (
        <>
          <Underoverskrift>Har under seg</Underoverskrift>
          <ul>
            {underordnede.map((u) => (
              <Rad key={u.key}>
                <Organnavn org={u} />
                {u.status === "nedlagt" && <span className="text-[0.8125rem] text-dempet"> (nedlagt)</span>}
              </Rad>
            ))}
          </ul>
        </>
      )}
      {[...grupper].map(([navn, liste]) => (
        <div key={navn}>
          <Underoverskrift>{navn}</Underoverskrift>
          <ul>
            {liste.map((r) => (
              <Rad
                key={`${r.type}|${r.retning}|${r.org.key}`}
                verdi={
                  <Kildemerke
                    belegg={r.belegg}
                    pastand={`${organ.navn}: ${navn.toLowerCase()} ${r.org.navn}`}
                  />
                }
              >
                <Organnavn org={r.org} />
                {(r.fra_dato || r.til_dato) && (
                  <p className="mt-0.5 text-[0.8125rem] text-dempet">
                    {r.fra_dato && `fra ${dato(r.fra_dato)}`}
                    {r.fra_dato && r.til_dato && " "}
                    {r.til_dato && `til ${dato(r.til_dato)}`}
                  </p>
                )}
              </Rad>
            ))}
          </ul>
        </div>
      ))}
    </Del>
  );
}

function Hendelse({ h }: { h: Endring }) {
  return (
    <Rad>
      <p className="text-[0.8125rem] font-semibold">
        <time dateTime={h.dato}>{datoStor(h.dato, h.presisjon)}</time>
        <span className="font-normal text-dempet"> · {HENDELSESTYPENAVN[h.type]}</span>
      </p>
      <p className="mt-0.5 leading-[1.4]">
        <Pastand tekst={ren(h.tittel)} belegg={h.belegg} />
      </p>
      {h.tekst && <p className="mt-0.5 text-[0.8125rem] leading-[1.45] text-dempet">{ren(h.tekst)}</p>}
    </Rad>
  );
}

function Hendelser({ profil, overskrift }: { profil: OrganProfil; overskrift: Overskrift }) {
  const kommende = profil.hendelser
    .filter((h) => !h.skjedd)
    .sort((a, b) => (a.dato < b.dato ? -1 : a.dato > b.dato ? 1 : 0));
  const skjedd = profil.hendelser.filter((h) => h.skjedd);
  if (!profil.hendelser.length) return null;
  return (
    <Del tittel="Hendelser" overskrift={overskrift}>
      {kommende.length > 0 && (
        <>
          <Underoverskrift>
            <span className="inline-flex items-baseline gap-2">
              Kommende
              <HarIkkeSkjedd />
            </span>
          </Underoverskrift>
          <ul className="border-l border-dashed border-kote pl-3">
            {kommende.map((h) => (
              <Hendelse key={`${h.dato}|${h.type}|${h.tittel}`} h={h} />
            ))}
          </ul>
        </>
      )}
      {skjedd.length > 0 && (
        <>
          {kommende.length > 0 && <Underoverskrift>Har skjedd</Underoverskrift>}
          <ul>
            {skjedd.map((h) => (
              <Hendelse key={`${h.dato}|${h.type}|${h.tittel}`} h={h} />
            ))}
          </ul>
        </>
      )}
    </Del>
  );
}

function Bransjer({ profil, overskrift }: { profil: OrganProfil; overskrift: Overskrift }) {
  const { segmenter } = profil.organ;
  if (!segmenter.length) return null;
  return (
    <Del tittel="Bransjer organet påvirker" overskrift={overskrift}>
      <ul className="flex flex-wrap gap-1">
        {segmenter.map((s) => (
          <li
            key={s.kode}
            className="inline-flex items-baseline gap-1.5 border border-linje-sterk px-[7px] py-[4px] text-[0.75rem] leading-[1.15]"
          >
            {s.navn}
            <span className="text-dempet">{STYRKE[s.styrke].navn.toLowerCase()}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[0.8125rem] leading-[1.45] text-dempet">
        Koblingen til bransjene er fra researchgrunnlagets oversikt over næringssegmenter.
      </p>
    </Del>
  );
}

function Hull({ profil, overskrift }: { profil: OrganProfil; overskrift: Overskrift }) {
  const hull = profil.hull.filter((h) => !erKonflikt(h));
  if (!hull.length) return null;
  return (
    <Del tittel={`Det vi ikke vet (${tall(hull.length)})`} overskrift={overskrift}>
      <ul className="flex flex-col gap-2.5">
        {hull.map((h) => (
          <li key={h.hva} className="flex gap-2.5 text-[0.875rem] leading-[1.45]">
            <span
              aria-hidden="true"
              className="mt-[0.4em] size-2.5 shrink-0 border border-dashed border-kote"
            />
            <span>
              <span className="font-medium">{ren(h.hva)}</span>{" "}
              <span className="text-kote-tekst">{ren(h.hvorfor)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Del>
  );
}

function Kildenavn({ kilde }: { kilde: KildeUt }) {
  if (!kilde.url) return <>{kilde.navn}</>;
  const [foran, siste] = splittSisteOrd(kilde.navn);
  return (
    <a
      href={kilde.url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
    >
      {foran}
      <span className="whitespace-nowrap">
        {siste}
        <ArrowUpRight className="ml-0.5 inline size-3.5 align-[-0.15em]" aria-hidden="true" />
      </span>
      <span className="sr-only"> (åpnes i ny fane)</span>
    </a>
  );
}

function Kilder({ profil, overskrift }: { profil: OrganProfil; overskrift: Overskrift }) {
  if (!profil.kilder.length) return null;
  return (
    <Del tittel={`Kilder (${tall(profil.kilder.length)})`} overskrift={overskrift}>
      <ul>
        {profil.kilder.map((k) => (
          <li
            key={k.key}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-linje py-2 text-[0.875rem] first:border-t-0"
          >
            <span className="min-w-0">
              <Kildenavn kilde={k} />
            </span>
            <span className="text-[0.8125rem] text-dempet">{KILDETYPER[k.type]}</span>
          </li>
        ))}
      </ul>
    </Del>
  );
}

// ---------------------------------------------------------------------------
// Fakta: registeropplysningene øverst i skuffen og i margen på organsiden
// ---------------------------------------------------------------------------

export function ProfilFakta({
  profil,
  className,
}: {
  profil: OrganProfil;
  className?: string;
}) {
  const { organ } = profil;
  const rader: [string, ReactNode][] = [
    [
      "Org.nr.",
      organ.orgnr ? (
        <MedMerke belegg={organ.belegg} pastand={`${organ.navn} har org.nr. ${orgnr(organ.orgnr)}`}>
          {orgnr(organ.orgnr)}
        </MedMerke>
      ) : (
        <span className="text-dempet">Ikke i datasettet</span>
      ),
    ],
    ["Nivå", NIVAANAVN[organ.nivaa]],
    ["Type", ORGANTYPENAVN[organ.organtype]],
  ];
  if (organ.antall_medlemmer !== null) rader.push(["Medlemmer", tall(organ.antall_medlemmer)]);
  if (organ.gyldig_fra) rader.push(["Fra", dato(organ.gyldig_fra)]);
  if (organ.status === "nedlagt")
    rader.push(["Nedlagt", organ.gyldig_til ? dato(organ.gyldig_til) : "Dato ikke oppgitt"]);
  return (
    <dl
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[0.875rem] leading-[1.4]",
        className,
      )}
    >
      {rader.map(([navn, verdi]) => (
        <div key={navn} className="contents">
          <dt className="text-dempet">{navn}</dt>
          <dd className="font-medium tabular-nums">{verdi}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Kommunene som har organet i datasettet, som lenker til kommunesiden. */
export function ProfilKommuner({ profil }: { profil: OrganProfil }) {
  if (!profil.kommuner.length) return null;
  return (
    <p className="text-[0.875rem] leading-[1.45] text-dempet">
      I kartet for{" "}
      {profil.kommuner.map((k, i) => (
        <span key={k.slug}>
          {i > 0 && (i === profil.kommuner.length - 1 ? " og " : ", ")}
          <a
            href={`/kommune/${k.slug}#organer`}
            className="font-semibold text-trykk underline decoration-linje-sterk underline-offset-[0.2em] hover:decoration-signal"
          >
            {k.navn}
          </a>
        </span>
      ))}
      .
    </p>
  );
}

// ---------------------------------------------------------------------------
// Hele profilen
// ---------------------------------------------------------------------------

export type ProfilDel =
  | "beskrivelse"
  | "roller"
  | "eierskap"
  | "nokkeltall"
  | "plass"
  | "hendelser"
  | "bransjer"
  | "hull"
  | "kilder";

/**
 * Delene i fast rekkefølge. `overskrift` er nivået delenes overskrifter får:
 * h3 i skuffen (tittelen er h2), h2 på organsiden (tittelen er h1).
 */
export function ProfilDeler({
  profil,
  overskrift = "h3",
  utelat = [],
  className,
}: {
  profil: OrganProfil;
  overskrift?: Overskrift;
  utelat?: readonly ProfilDel[];
  className?: string;
}) {
  const med = (d: ProfilDel) => !utelat.includes(d);
  const p = { profil, overskrift };
  return (
    <div className={className}>
      {med("beskrivelse") && <Beskrivelse {...p} />}
      {med("roller") && <Roller {...p} />}
      {med("eierskap") && <Eierskap {...p} />}
      {med("nokkeltall") && <Nokkeltall {...p} />}
      {med("plass") && <Plass {...p} />}
      {med("hendelser") && <Hendelser {...p} />}
      {med("bransjer") && <Bransjer {...p} />}
      {med("hull") && <Hull {...p} />}
      {med("kilder") && <Kilder {...p} />}
    </div>
  );
}
