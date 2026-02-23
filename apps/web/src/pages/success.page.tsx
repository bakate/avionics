import { Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import { ROUTES } from "../routes";

export default function SuccessPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pnr = searchParams.get("pnr");

  return (
    <div className="mx-auto max-w-3xl py-24 px-4 text-center">
      <div className="flex flex-col items-center justify-center mb-10">
        <div className="flex size-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-8 animate-bounce">
          <HugeiconsIcon icon={Tick01Icon} size={48} />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight mb-6">
          {t("success.title")}
        </h1>
        <p className="text-slate-600 text-xl max-w-lg mx-auto mb-10">
          {t("success.message")}
        </p>

        {pnr ? (
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 mb-12 w-full max-w-md">
            <p className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-2">
              {t("success.pnrLabel")}
            </p>
            <p className="text-4xl font-black text-slate-900 dark:text-slate-50 font-mono tracking-tighter">
              {pnr}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4">
        {pnr ? (
          <Button
            size="lg"
            className="h-14 px-8 text-lg font-bold"
            onClick={() => navigate(`/confirmation/${pnr}`)}
          >
            {t("success.viewBooking")}
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-14 px-8 text-lg font-bold"
            onClick={() => navigate(ROUTES.home)}
          >
            {t("success.goHome")}
          </Button>
        )}
      </div>

      <p className="mt-12 text-slate-400 text-sm italic">
        {t("success.emailNotice")}
      </p>
    </div>
  );
}
