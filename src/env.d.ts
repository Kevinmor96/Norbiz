// Miljøvariablene koden leser med punktum-tilgang. tsconfig har
// `noPropertyAccessFromIndexSignature`, så de må deklareres.

interface ImportMetaEnv {
  /** "1" i den statiske eksporten (vite.statisk.config.ts), ellers utelatt. */
  readonly VITE_STATISK?: string;
}
