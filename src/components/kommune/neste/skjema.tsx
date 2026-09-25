// Skjemadelene stemmen, Pro-ventelisten og «Er dette deg?» deler: felt,
// nedtrekk, knapp og den ærlige kvitteringen (DESIGN.md §5.8, §5.9).
//
// Kvitteringen sier nøyaktig hva som skjedde. Er ingenting lagret, står det
// med den stiplede trekanten og kotefargen, samme tegn som for det som er
// planlagt og ikke har skjedd. Bare en lagret rad får hel ramme og hake.

import { ArrowRight, Check } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Mottak } from "@/lib/venteliste";

/** Kanten og flaten alle felt deler: rett hjørne, trykkfarge, fokus i signal. */
export const FELTFLATE = cn(
  "h-12 w-full min-w-0 appearance-none border border-trykk bg-flate px-3.5 text-base text-trykk",
  "placeholder:text-dempet focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-signal",
  "aria-[invalid=true]:border-signal",
);

export function Felt({
  etikett,
  hjelp,
  feil,
  children,
  className,
}: {
  etikett: string;
  hjelp?: ReactNode;
  feil?: string | null;
  /** Feltet selv. Får id, aria-describedby og aria-invalid fra `render`. */
  children: (a: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean;
  }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const hjelpId = hjelp ? `${id}-hjelp` : undefined;
  const feilId = feil ? `${id}-feil` : undefined;
  const beskrevet = [hjelpId, feilId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        {etikett}
      </label>
      {hjelp && (
        <p id={hjelpId} className="text-[0.8125rem] leading-[1.4] text-dempet">
          {hjelp}
        </p>
      )}
      {children({ id, "aria-describedby": beskrevet, "aria-invalid": Boolean(feil) })}
      {feil && (
        <p id={feilId} className="text-[0.8125rem] font-semibold text-signal-tekst">
          {feil}
        </p>
      )}
    </div>
  );
}

/** Nedtrekk med egen pil. Den innebygde pila følger ikke fargene i nattkartet. */
export function Nedtrekk({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative min-w-0">
      <select {...props} className={cn(FELTFLATE, "cursor-pointer pr-10", className)}>
        {children}
      </select>
      <svg
        viewBox="0 0 12 12"
        width="12"
        height="12"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-trykk"
      >
        <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

export function Hovedknapp({
  children,
  sender = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { sender?: boolean }) {
  return (
    <button
      type="submit"
      {...props}
      disabled={sender || props.disabled}
      aria-busy={sender || undefined}
      className={cn(
        "inline-flex h-12 cursor-pointer items-center justify-center gap-2.5 self-start border border-trykk bg-trykk px-5",
        "text-[0.9375rem] font-semibold text-paa-trykk",
        "transition-[transform,background-color] duration-150 ease-(--ease-ut) hover:bg-dempet active:scale-[0.97]",
        "disabled:cursor-progress disabled:bg-dempet",
        className,
      )}
    >
      {sender ? "Sender …" : children}
      {!sender && <ArrowRight className="size-4" aria-hidden="true" />}
    </button>
  );
}

/** Den stiplede trekanten: ikke gjort ennå. Samme tegn som forhåndsversjonen bruker. */
function IkkeGjort() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="18"
      height="18"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-kote"
    >
      <path
        d="M8 1.8 14.6 13.6H1.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2.6 1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Kvitteringen etter at skjemaet er sendt. `tekster` gir setningen for hvert
 * utfall, så hvert skjema kan si «stemmen», «adressen» eller «henvendelsen».
 * Står i en aria-live-region som finnes før innsending, så skjermlesere hører
 * den.
 */
export function Kvittering({
  mottak,
  tittel,
  detalj,
}: {
  mottak: Mottak | null;
  tittel: string;
  detalj?: ReactNode;
}) {
  return (
    <div aria-live="polite" role="status">
      {mottak && (
        <div
          className={cn(
            "flex items-start gap-3 px-4 py-3.5",
            "transition-[opacity,transform] duration-200 ease-(--ease-ut) starting:translate-y-1 starting:opacity-0",
            mottak.status === "lagret"
              ? "border border-trykk bg-flate"
              : "border border-dashed border-kote bg-papir",
          )}
        >
          {mottak.status === "lagret" ? (
            <Check className="mt-0.5 size-[18px] shrink-0 text-trykk" aria-hidden="true" />
          ) : (
            <IkkeGjort />
          )}
          <p className="text-[0.9375rem] leading-[1.45] text-pretty">
            <b
              className={cn("block font-semibold", mottak.status === "feil" && "text-signal-tekst")}
            >
              {tittel}
            </b>
            {detalj && <span className="mt-1 block text-[0.8125rem] text-dempet">{detalj}</span>}
          </p>
        </div>
      )}
    </div>
  );
}
