import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";

const BESKRIVELSE =
  "Hvem bestemmer i kommunen din? Maktkart viser organene, rollene og pengene i en kommune og hvordan de henger sammen, med kilde og dato på hver påstand.";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold tabular-nums text-foreground">404</h1>
        <h2 className="mt-4 text-lg font-semibold text-foreground">Siden finnes ikke</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Adressen peker ingen steder her. Lenken kan være skrevet feil, eller siden kan være
          flyttet.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Til forsiden
          </Link>
        </div>
      </div>
    </div>
  );
}

// Nyere @tanstack/react-router typer `error` som unknown, ikke Error.
function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Siden lastet ikke</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Noe gikk galt hos oss. Prøv igjen, eller gå til forsiden.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Prøv igjen
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Til forsiden
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Maktkart" },
      { name: "description", content: BESKRIVELSE },
      { property: "og:site_name", content: "Maktkart" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Maktkart" },
      { property: "og:description", content: BESKRIVELSE },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
    scripts: [{ children: themeInitScript }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Temaskriptet i <head> kan sette data-theme før React hydrerer.
  return (
    <html lang="nb" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* Påkrevd: underrutene tegnes her. Uten <Outlet /> brekker alle undersider. */}
        <Outlet />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
