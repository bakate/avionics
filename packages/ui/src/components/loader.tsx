import { cn } from "../lib/utils";

interface SimpleLoaderProps {
  className?: string;
}
export const SimpleLoader = ({ className }: SimpleLoaderProps) => {
  return (
    <div className={cn("grid h-screen place-items-center p-4", className)}>
      <div className="border-primary ml-3 h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 ease-linear"></div>
    </div>
  );
};
