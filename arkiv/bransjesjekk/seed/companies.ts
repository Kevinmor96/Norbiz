import type { Rng } from './rng.js';
import type { IndustryRow } from './industries.js';
import type { CompanyRow } from './types.js';

const FORMS: [string, number][] = [['AS', 0.62], ['ENK', 0.28], ['NUF', 0.05], ['ASA', 0.02], ['SA', 0.03]];
const PREFIX = ['Nord','Vest','Sør','Øst','Fjell','Vik','Berg','Lund','Haug','Strand','Dal','Elv'];
const SUFFIX = ['gruppen','partner','service','senter','kompaniet','verksted','huset','byrået'];

/** 300 selskaper, kun siste regnskapsår. ENK mangler regnskapstall. */
export function buildCompanies(
  rng: Rng, industries: IndustryRow[], kommuner: string[], count = 300,
): CompanyRow[] {
  const leaves = industries.filter((i) => i.nace_level === 5);
  const out: CompanyRow[] = [];
  const seen = new Set<number>();
  while (out.length < count) {
    const ind = rng.pick(leaves);
    const form = pickWeighted(rng, FORMS);
    const orgNr = 800000000 + Math.floor(rng.next() * 199999999);
    if (seen.has(orgNr)) continue;
    seen.add(orgNr);
    const filesAccounts = ['AS', 'ASA', 'NUF', 'SA'].includes(form);
    const ansatte = Math.max(0, Math.round(rng.range(0, 45) ** 0.8));
    const omsetning = filesAccounts ? Math.round(rng.range(4e5, 9e7)) : null;
    out.push({
      org_nr: String(orgNr),
      navn: `${rng.pick(PREFIX)} ${ind.common_name.toLowerCase()} ${rng.pick(SUFFIX)} ${form}`
        .replace(/\s+/g, ' '),
      nace_code: ind.nace_code,
      kommune_code: rng.pick(kommuner),
      organisasjonsform: form,
      ansatte,
      omsetning,
      // ENK leverer ikke årsregnskap, så tallene mangler - de er ikke null.
      driftsresultat: omsetning === null ? null : Math.round(omsetning * rng.range(-0.08, 0.22)),
      egenkapital: omsetning === null ? null : Math.round(omsetning * rng.range(0.05, 0.45)),
      regnskapsar: filesAccounts ? 2023 : null,
    });
  }
  return out;
}

function pickWeighted(rng: Rng, pairs: [string, number][]): string {
  const t = rng.next();
  let acc = 0;
  for (const [v, w] of pairs) { acc += w; if (t <= acc) return v; }
  return pairs[pairs.length - 1]![0];
}
