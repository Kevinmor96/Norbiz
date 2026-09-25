// Lenken fra et organnavn i kjeden og tidslinjen til organet.
//
// Organskuffen (DESIGN.md §5.3) eies av organkartet. Så lenge den ikke har et
// felles grensesnitt, går lenken til organprofilen /organ/$key. Står lenken
// ett sted, er byttet til skuffen én endring.

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { OrganRef } from "@/lib/data";

export function OrganLenke({
  org,
  className,
  children,
}: {
  org: OrganRef;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link to="/organ/$key" params={{ key: org.key }} className={className}>
      {children ?? org.navn}
    </Link>
  );
}
