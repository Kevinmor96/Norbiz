// Det en loader sender til siden. Alt en loader returnerer, serialiseres inn i
// HTML-en som tilstanden React hydrerer fra. Der leser også søkemotorer og
// «vis kilde», og den er en stor del av sidevekten. `tilSiden` gjør to ting
// med svaret fra datalaget, i én gjennomgang:
//
// 1. Hver streng går gjennom `lesbar`, så «[verifiser]» fra grunnlaget heller
//    ikke står i den serialiserte tilstanden (DESIGN.md §3).
// 2. Like objekter blir ett objekt. Datalaget lager et nytt objekt for hver
//    forekomst av samme kilde eller samme organ. Serialiseringen skriver et
//    objekt bare én gang og peker til det siden, men bare når det er samme
//    objekt. Kilden «NRK» og organet «Troms Kraft AS» sto derfor hundrevis av
//    ganger i HTML-en.
//
// Deling er trygt fordi svaret bare leses. Lister deles ikke, fordi en liste
// kan bli sortert på stedet, og da ville sorteringen slått ut andre steder.

import { lesbar } from "@/lib/format";

export function tilSiden<T>(svar: T): T {
  const kopier = new WeakMap<object, unknown>();
  const felles = new Map<string, object>();
  const nr = new WeakMap<object, number>();
  let neste = 0;
  const id = (o: object) => {
    let n = nr.get(o);
    if (n === undefined) nr.set(o, (n = neste++));
    return n;
  };

  const gaa = (v: unknown): unknown => {
    if (typeof v === "string") return lesbar(v);
    if (v === null || typeof v !== "object") return v;
    const kjent = kopier.get(v);
    if (kjent !== undefined) return kjent;

    if (Array.isArray(v)) {
      const ut: unknown[] = [];
      kopier.set(v, ut);
      for (const x of v) ut.push(gaa(x));
      return ut;
    }
    // Bare vanlige objekter. Datoer, Map og klasser slippes gjennom urørt.
    if (Object.getPrototypeOf(v) !== Object.prototype) return v;

    const ut: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) ut[k] = gaa(x);
    // Nøkkelen er innholdet, med barneobjektene som nummer. Barna er alt
    // delt, så to like objekter har like barn og får samme nøkkel.
    const nokkel = JSON.stringify(
      Object.entries(ut).map(([k, x]) => [
        k,
        x !== null && typeof x === "object" ? `#${id(x)}` : x,
      ]),
    );
    const delt = felles.get(nokkel);
    if (delt) {
      kopier.set(v, delt);
      return delt;
    }
    felles.set(nokkel, ut);
    kopier.set(v, ut);
    return ut;
  };
  return gaa(svar) as T;
}
