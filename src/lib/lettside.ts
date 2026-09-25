// Det av kommunesiden som serialiseres inn i HTML-en (se src/lib/kommuneside.ts).
// Egen fil fordi ruten trenger den i nettleseren også, og kommuneside.ts laster
// datalaget.

import type { Kommuneside, Lettside } from "@/lib/kommuneside";

export function lettside(side: Kommuneside): Lettside {
  return {
    kommune: side.kommune,
    oversikt: side.oversikt,
    grader: side.grader,
    terrengKreditt: side.terreng?.attribusjon ?? null,
  };
}
