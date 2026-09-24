import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/organ/$key")({
  head: () => ({
    meta: [{ title: "Organprofil | Maktkart" }],
  }),
  component: Organprofil,
});

function Organprofil() {
  const { key } = Route.useParams();

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Organprofil</h1>
      <p className="mt-4 text-muted-foreground">Profilen for «{key}» er under arbeid.</p>
    </main>
  );
}
