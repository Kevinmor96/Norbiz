import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [{ title: "Pro | Maktkart" }],
  }),
  component: Pro,
});

function Pro() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Maktkart Pro</h1>
      <p className="mt-4 text-muted-foreground">Pro finnes ikke ennå. Her kommer ventelisten.</p>
    </main>
  );
}
