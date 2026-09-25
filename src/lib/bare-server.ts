// Data som bare skal finnes på serveren: med når siden rendres der, borte i
// HTML-en.
//
// Kommunesiden rendres på serveren fra hele datasettet, men bare det lille som
// må være levende med én gang, serialiseres inn i HTML-en. Resten pakkes i
// `BareServer`. Serialiseringsadapteren under (registrert i src/start.ts)
// skriver den som `null`, så nettleseren får `new BareServer(null)` og henter
// dataene selv etter at siden er vist (src/routes/kommune.$slug.tsx).
//
// Adapteren gjelder alt TanStack Start serialiserer: loaderdata og svar fra
// serverfunksjoner. En serverfunksjon skal derfor aldri returnere en
// `BareServer` den vil at nettleseren skal lese.

import { createSerializationAdapter } from "@tanstack/react-router";

export class BareServer<T> {
  constructor(readonly verdi: T | null) {}
}

export const bareServerAdapter = createSerializationAdapter({
  key: "maktkart-bare-server",
  test: (v: unknown): v is BareServer<unknown> => v instanceof BareServer,
  toSerializable: () => null,
  fromSerializable: () => new BareServer<unknown>(null),
});
