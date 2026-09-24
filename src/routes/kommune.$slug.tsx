import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/kommune/$slug")({
  head: () => ({
    meta: [{ title: "Hvem bestemmer her? | Maktkart" }],
  }),
  component: Kommuneside,
});

function Kommuneside() {
  const { slug } = Route.useParams();

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Hvem bestemmer her?</h1>
      <p className="mt-4 text-muted-foreground">Kommunesiden for «{slug}» er under arbeid.</p>
    </main>
  );
}
