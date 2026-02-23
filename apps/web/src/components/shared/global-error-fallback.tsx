import {
  AlertCircleIcon,
  Home01Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { SectionCard } from "@workspace/ui/components/section-card";
import { type FallbackProps } from "react-error-boundary";
import { useTranslation } from "react-i18next";

import { useRouteError } from "react-router";

export const GlobalErrorFallback = ({
  error: propsError,
  resetErrorBoundary,
}: Partial<FallbackProps>) => {
  const { t } = useTranslation();
  const routeError = useRouteError();

  // Get error from either source
  const error = propsError ?? routeError;
  const errorMessage = error instanceof Error ? error.message : String(error);

  const handleReset = () => {
    if (resetErrorBoundary) {
      resetErrorBoundary();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center dark:bg-slate-950 bg-slate-50">
      <SectionCard
        className="max-w-md w-full backdrop-blur-xl shadow-2xl overflow-hidden"
        title={t("globalError.title")}
        description={t("globalError.subtitle")}
        icon={
          <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-500 ring-1 ring-rose-500/30">
            <HugeiconsIcon icon={AlertCircleIcon} size={20} />
          </div>
        }
        verticalLayout
      >
        <div className="pt-2">
          <div className="rounded-xl dark:bg-black/40 bg-white/5 border border-white/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mb-2">
              {t("globalError.details")}
            </p>
            <p className="text-xs font-mono text-destructive wrap-break-word line-clamp-6 leading-relaxed">
              {errorMessage}
            </p>
          </div>

          <p className="text-xs text-slate-500 text-center italic">
            {t("globalError.notice")}
          </p>

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleReset}
              className="w-full transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <HugeiconsIcon icon={Refresh01Icon} size={18} className="mr-2" />
              {t("globalError.reset")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                window.location.href = "/";
              }}
              className="w-full dark:text-slate-400 text-slate-600 hover:bg-white/5 dark:hover:bg-black/5 h-12"
            >
              <HugeiconsIcon icon={Home01Icon} size={18} className="mr-2" />
              {t("globalError.backHome")}
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
