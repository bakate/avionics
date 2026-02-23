import { AlertCircleIcon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useTranslation } from "react-i18next";

interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorDisplay = ({
  title,
  message,
  onRetry,
  className,
}: ErrorDisplayProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/50 dark:bg-rose-950/20",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
        <HugeiconsIcon icon={AlertCircleIcon} size={24} />
      </div>
      <h3 className="mb-2 text-lg font-bold text-rose-900 dark:text-rose-100">
        {title || t("common.error")}
      </h3>
      <p className="max-w-md text-sm text-rose-700 dark:text-rose-300">
        {message}
      </p>
      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-6 gap-2 border-rose-200 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/50"
        >
          <HugeiconsIcon icon={Refresh01Icon} size={16} />
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
};
