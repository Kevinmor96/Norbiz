import { useMediaQuery } from "./use-media-query";

/**
 * `true` når leseren har bedt om redusert bevegelse. Da er alt statisk:
 * tilstander skifter fortsatt, men uten forflytning (DESIGN.md §7).
 *
 * På serveren er svaret `true`, så det som tegnes der, er ferdig tegnet. En
 * bevegelse som starter fra en skjult tilstand, blir aldri sendt fra serveren.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)", true);
}
