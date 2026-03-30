import { type ReactNode } from "react";
import { cn } from "../lib/utils";

interface SectionProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  variant?: "default" | "muted" | "full";
  spacing?: "none" | "sm" | "md" | "lg" | "xl";
}

const bgStyles = {
  default: "bg-background",
  muted: "bg-muted/30 dark:bg-muted/10",
  full: "bg-primary text-primary-foreground",
};

const spacingStyles = {
  none: "py-0",
  sm: "py-8 sm:py-12",
  md: "py-16 sm:py-24",
  lg: "py-24 sm:py-32",
  xl: "py-32 sm:py-48",
};

export const Section = ({
  children,
  className,
  containerClassName,
  variant = "default",
  spacing = "md",
}: SectionProps) => {
  return (
    <section
      className={cn(bgStyles[variant], spacingStyles[spacing], className)}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-7xl px-6 lg:px-8",
          containerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
};
