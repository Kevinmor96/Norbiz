import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** «system» betyr at prefers-color-scheme bestemmer. Det er standard. */
export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  /** Det som faktisk vises nå, etter at «system» er slått opp. */
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const THEME_STORAGE_KEY = "maktkart-tema";

/**
 * Kjøres i <head> før første maling, slik at et lagret valg ikke blinker.
 * Uten lagret valg gjør skriptet ingenting, og CSS-en følger systemet.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){var d=document.documentElement;d.setAttribute("data-theme",t);d.classList.toggle("dark",t==="dark");}}catch(e){}})();`;

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
    root.classList.remove("dark");
  } else {
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", theme === "dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // I en transition: React vet ikke hvilke kontekster en uhydrert
    // Suspense-grense bruker, så en vanlig oppdatering her tvinger hver grense
    // som venter på data (kommunesidens seksjoner) over til å tegnes i
    // nettleseren, med tom reserve i mellomtiden. En transition kan vente til
    // grensene er hydrert.
    startTransition(() => {
      setThemeState(readStoredTheme());
      setSystemDark(systemPrefersDark());
      setMounted(true);
    });

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    try {
      if (theme === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Lagring kan være blokkert (privat vindu). Valget gjelder da bare denne visningen.
    }
  }, [theme, mounted]);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Samme objekt så lenge temaet er det samme. Et nytt objekt per rendering er
  // en kontekstendring, og den har samme virkning som over.
  const verdi = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState(resolvedTheme === "dark" ? "light" : "dark"),
    }),
    [theme, resolvedTheme],
  );

  return <ThemeContext.Provider value={verdi}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme må brukes innenfor ThemeProvider");
  }
  return context;
}
