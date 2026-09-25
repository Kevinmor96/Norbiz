// En del av forsiden, metodesiden eller Pro-siden: overskrift, ingress og
// innhold, med samme rytme som seksjonene på kommunesiden. Uten regionnavn
// over tittelen: på disse sidene bærer overskriften seg selv.

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Sidedel({
  id,
  tittel,
  ingress,
  children,
  className,
  smal = false,
}: {
  id?: string;
  tittel: ReactNode;
  ingress?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Mindre luft, for tette sider som metoden. */
  smal?: boolean;
}) {
  const tittelId = id ? `${id}-tittel` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={tittelId}
      className={cn(
        "scroll-mt-[calc(var(--topp)+16px)] border-t border-linje",
        smal ? "py-[clamp(40px,5vw,64px)]" : "py-[clamp(56px,8vw,104px)]",
        className,
      )}
    >
      <header className={cn("flex max-w-[62ch] flex-col gap-3", smal ? "mb-7" : "mb-[clamp(28px,4vw,44px)]")}>
        <h2
          id={tittelId}
          className={cn(
            "seksjon",
            smal
              ? "text-[clamp(1.5rem,1.2rem+1.2vw,2.125rem)]"
              : "text-[clamp(1.75rem,1.2rem+2vw,2.8rem)]",
          )}
        >
          {tittel}
        </h2>
        {ingress && (
          <p className="ingress text-[clamp(1rem,0.95rem+0.25vw,1.125rem)] text-dempet">{ingress}</p>
        )}
      </header>
      {children}
    </section>
  );
}
