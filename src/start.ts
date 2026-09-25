import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { bareServerAdapter } from "./lib/bare-server";
import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start legger inn denne av seg selv når src/start.ts mangler. Å definere filen
// slår det av, så den legges til igjen her for at serverfunksjoner fortsatt skal
// være beskyttet mot forespørsler fra andre nettsteder.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
  // Data merket bare-server (src/lib/bare-server.ts) skrives som null i HTML-en.
  serializationAdapters: [bareServerAdapter],
}));
