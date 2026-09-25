// Løypesymbolene i kjeden, tegnet likt i løypekartet, i sporet på mobil og i
// stegets hode: starttrekant, post i ring, dobbel ring ved vedtaket og en
// stiplet ring for posten som ikke er kartlagt (DESIGN.md §5.2).
//
// Starttrekanten er stor, står i signalfarge og finnes bare i løypa.
// Kildemerkets trekant er liten, står i kote og står etter en påstand. De skal
// aldri forveksles, så trekanten her har aldri kotefarge.

import { cn } from "@/lib/utils";

import type { Postform } from "./modell";

/**
 * Symbolet sentrert i (x, y) i SVG-koordinater. `aktiv` gir tykkere strek og
 * en lett tone inni, `passert` bare tonen.
 */
export function PostSymbol({
  form,
  x,
  y,
  aktiv = false,
  passert = false,
  strek: grunnstrek = 2.2,
}: {
  form: Postform;
  x: number;
  y: number;
  aktiv?: boolean;
  passert?: boolean;
  /** Strekbredden i SVG-enheter. Små ikoner skaleres ned og trenger tykkere strek. */
  strek?: number;
}) {
  const strek = cn(
    "fill-none transition-[stroke-width] duration-200 ease-(--ease-ut)",
    form === "mangler" ? "stroke-kote" : "stroke-signal",
  );
  const bredde = aktiv ? grunnstrek * 1.55 : grunnstrek;
  const tone = cn(
    "fill-signal transition-[fill-opacity] duration-300 ease-(--ease-ut)",
    aktiv ? "[fill-opacity:0.16]" : passert ? "[fill-opacity:0.09]" : "[fill-opacity:0]",
  );

  if (form === "start") {
    const d = `M${x} ${y - 22}L${x + 19.5} ${y + 12}H${x - 19.5}Z`;
    return (
      <g>
        <path d={d} className={tone} />
        <path d={d} className={strek} strokeWidth={bredde} strokeLinejoin="round" />
      </g>
    );
  }
  if (form === "maal") {
    return (
      <g>
        <circle cx={x} cy={y} r={22} className={tone} />
        <circle cx={x} cy={y} r={22} className={strek} strokeWidth={bredde} />
        <circle cx={x} cy={y} r={13} className={strek} strokeWidth={bredde} />
      </g>
    );
  }
  if (form === "mangler") {
    return (
      <g>
        <circle
          cx={x}
          cy={y}
          r={18}
          className="fill-papir stroke-kote"
          strokeWidth={grunnstrek * 0.9}
          strokeDasharray="4 3.2"
        />
        <text
          x={x}
          y={y + 6}
          textAnchor="middle"
          className="fill-kote-tekst text-[17px] font-extrabold"
        >
          ?
        </text>
      </g>
    );
  }
  return (
    <g>
      <circle cx={x} cy={y} r={18} className={tone} />
      <circle cx={x} cy={y} r={18} className={strek} strokeWidth={bredde} />
    </g>
  );
}

/** Symbolet som eget lite bilde, til sporet på mobil og stegets hode på skrivebord. */
export function PostIkon({
  form,
  storrelse = 28,
  aktiv = false,
  passert = false,
  className,
}: {
  form: Postform;
  storrelse?: number;
  aktiv?: boolean;
  passert?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="-26 -26 52 52"
      width={storrelse}
      height={storrelse}
      aria-hidden="true"
      focusable="false"
      className={cn("block shrink-0 overflow-visible", className)}
    >
      <PostSymbol form={form} x={0} y={0} aktiv={aktiv} passert={passert} strek={3.6} />
    </svg>
  );
}
