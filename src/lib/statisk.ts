// Om koden kjører i den statiske eksporten. vite.statisk.config.ts setter
// VITE_STATISK=1, og Vite skriver verdien inn i buntene. Der finnes ingen
// server: svarene hentes som filer bygget ved eksporten, og rutene som bare
// finnes for eksporten (som /data/sokeindeks.json), svarer 404 ellers.
//
// Punktum-tilgangen er med vilje: `import.meta.env["…"]` får Vite til å skrive
// hele env-objektet inn i hver bit som bruker det.

export const STATISK = import.meta.env.VITE_STATISK === "1";
