import { cn } from "../lib/utils";
import { Separator } from "./separator";

interface HeadingProps {
  title: string;
  description?: string;
  className?: string;
  withSeparator?: boolean;
  headerClassName?: string;
  descriptionClassName?: string;
}
export const Heading = ({
  title,
  description,
  className,
  withSeparator,
  headerClassName,
  descriptionClassName,
}: HeadingProps) => {
  return (
    <div className={cn("mb-4 space-y-2 sm:mb-0", className)}>
      <h1
        className={cn(
          "text-foreground font-headline text-2xl font-bold tracking-tight sm:text-3xl",
          headerClassName,
        )}
      >
        {title}
      </h1>
      <p
        className={cn("text-muted-foreground max-w-3xl", descriptionClassName)}
      >
        {description}
      </p>
      {withSeparator ? <Separator /> : null}
    </div>
  );
};
