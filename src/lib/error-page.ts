// Frittstående feilside for når SSR feiler før React kan tegne noe. Den kan ikke
// bruke stilarket eller komponentene, så alt står inline og med systemfonter.
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="nb">
  <head>
    <meta charset="utf-8" />
    <title>Siden lastet ikke</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light dark; }
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
      @media (prefers-color-scheme: dark) {
        body { background: #111; color: #f5f5f5; }
        p { color: #a3a3a3; }
        .primary { background: #f5f5f5; color: #111; }
        .secondary { background: #111; color: #f5f5f5; border-color: #404040; }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Siden lastet ikke</h1>
      <p>Noe gikk galt hos oss. Prøv å laste siden på nytt, eller gå til forsiden.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Prøv igjen</button>
        <a class="secondary" href="/">Til forsiden</a>
      </div>
    </div>
  </body>
</html>`;
}
