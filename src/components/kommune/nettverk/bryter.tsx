// Bryteren «Vis eierskap» (DESIGN.md §5.5), bygget på shadcn-komponenten
// Switch i src/components/ui/switch.tsx, så den flyttes til Lovable som den er.
// Påslått bryter er vann, fordi laget den slår på er eierskap, og vann betyr
// penger. Avslått er den papir med blekkramme, så av og på skilles på mer enn
// hvor tappen står.

import { useId } from "react";

import { Switch } from "@/components/ui/switch";
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
      <Switch
        id={id}
        checked={pa}
        onCheckedChange={settPa}
        className={cn(
          "border border-trykk p-[2px] shadow-none duration-150 ease-(--ease-ut)",
          "data-[state=unchecked]:bg-papir data-[state=checked]:border-vann data-[state=checked]:bg-vann",
          // Tappen: blekk på papir, papir på vann.
          "[&>span]:size-3.5 [&>span]:bg-trykk [&>span]:shadow-none [&>span]:duration-150 [&>span]:ease-(--ease-ut)",
          "data-[state=checked]:[&>span]:bg-papir",
        )}
      />
      <label htmlFor={id} className="cursor-pointer text-[0.875rem] font-semibold select-none">
        {children}
      </label>
    </div>
  );
}
