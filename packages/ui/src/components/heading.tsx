import { cn } from "../lib/utils";
import { Separator } from "./separator";

interface HeadingProps {
  title: string;
  description?: string;
  className?: string;
  withSeparator?: boolean;
  headerClassName?: string;
  descriptionClassName?: string;
  level?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export const Heading = ({
  title,
  description,
  className,
  withSeparator,
  headerClassName,
  descriptionClassName,
  level = "h1",
}: HeadingProps) => {
  const Tag = level;

  const levelStyles = {
    h1: "text-4xl font-black tracking-tighter sm:text-6xl",
    h2: "text-3xl font-bold tracking-tight sm:text-4xl",
    h3: "text-2xl font-bold tracking-tight sm:text-3xl",
    h4: "text-xl font-bold tracking-tight sm:text-2xl",
    h5: "text-lg font-bold tracking-tight",
    h6: "text-base font-bold tracking-tight",
  };

  return (
    <div className={cn("mb-6 space-y-3", className)}>
      <Tag
        className={cn(
          "text-foreground font-headline",
          levelStyles[level],
          headerClassName,
        )}
      >
        {title}
      </Tag>
      {description ? (
        <p
          className={cn(
            "text-muted-foreground max-w-3xl text-balance text-lg leading-relaxed",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
      {withSeparator ? <Separator /> : null}
    </div>
  );
};
