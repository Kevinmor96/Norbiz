import { useTheme } from "./theme-provider";

/**
 * Bytter mellom lyst kart (kartpapir) og mørkt kart (nattkart).
 *
 * Teksten velges i CSS med dark:-varianten, ikke fra React-tilstanden. På
 * serveren vet vi ikke hva systemet foretrekker, og da ville knappen vist feil
 * tekst til siden var hydrert.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 border border-linje-sterk px-2.5 text-[0.875rem] whitespace-nowrap transition-[background-color,transform] duration-150 ease-(--ease-ut) hover:bg-flate-2 active:scale-[0.97] max-sm:w-10 max-sm:px-0 ${className}`}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="shrink-0">
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" />
      </svg>
      <span className="dark:hidden max-sm:sr-only">Mørkt kart</span>
      <span className="hidden dark:inline max-sm:sr-only">Lyst kart</span>
    </button>
  );
}
