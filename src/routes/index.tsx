import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Maktkart: hvem bestemmer i din kommune?" }],
  }),
  component: Forside,
});

function Forside() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Hvem bestemmer i din kommune?</h1>
      <p className="mt-4 text-muted-foreground">
        Maktkart viser organene, rollene og pengene i en kommune, med kilde og dato på hver påstand.
      </p>
    </main>
  );
}
