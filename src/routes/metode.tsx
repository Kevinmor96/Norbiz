import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/metode")({
  head: () => ({
    meta: [{ title: "Metode | Maktkart" }],
  }),
  component: Metode,
});

function Metode() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Metode</h1>
      <p className="mt-4 text-muted-foreground">
        Her kommer kildene, verifiseringsgradene og personvernet bak tallene.
      </p>
    </main>
  );
}
