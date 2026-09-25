// Bryteren «Vis eierskap» (DESIGN.md §5.5). shadcn har ingen Switch i
// prosjektet, så den bygges her rett på Radix, med rette hjørner. Påslått
// bryter er vann, fordi laget den slår på er eierskap, og vann betyr penger.

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useId } from "react";

import { cn } from "@/lib/utils";

export function Bryter({
  pa,
  settPa,
  children,
  className,
}: {
  pa: boolean;
  settPa: (pa: boolean) => void;
  children: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <SwitchPrimitive.Root
        id={id}
        checked={pa}
        onCheckedChange={settPa}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center border border-trykk bg-papir p-[2px]",
          "transition-colors duration-150 ease-(--ease-ut) data-[state=checked]:border-vann data-[state=checked]:bg-vann",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block size-3.5 bg-trykk transition-transform duration-150 ease-(--ease-ut)",
            "data-[state=checked]:translate-x-4 data-[state=checked]:bg-papir",
          )}
        />
      </SwitchPrimitive.Root>
      <label htmlFor={id} className="cursor-pointer text-[0.875rem] font-semibold select-none">
        {children}
      </label>
    </div>
  );
}
