import { cn } from "@workspace/ui/lib/utils";

interface HeroStatBadgeProps {
  readonly value: string;
  readonly label: string;
  readonly className?: string;
}

export const HeroStatBadge = ({
  value,
  label,
  className,
}: HeroStatBadgeProps) => (
  <div
    className={cn(
      "flex flex-col items-center gap-1 px-6 first:pl-0 last:pr-0 border-r border-white/20 last:border-r-0",
      className,
    )}
  >
    <span className="text-2xl font-bold tracking-tighter text-white">
      {value}
    </span>
    <span className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
      {label}
    </span>
  </div>
);
