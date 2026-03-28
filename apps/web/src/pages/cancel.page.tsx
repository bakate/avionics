import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Heading } from "@workspace/ui/components/heading";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { bookingActor } from "@/features/booking/machines/booking.actor";
import { ROUTES } from "@/routes";

const CancelPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    // Send cancel event to machine
    bookingActor.send({ type: "CANCEL_PAYMENT" });

    // Redirect back to payment page
    const timer = setTimeout(() => {
      void navigate(ROUTES.payment);
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 px-4">
      <div className="size-16 bg-amber-500/15 text-amber-600 rounded-full flex items-center justify-center animate-pulse">
        <HugeiconsIcon icon={Cancel01Icon} size={32} strokeWidth={2.5} />
      </div>

      <Heading
        title={t("payment.cancelledTitle")}
        description={t("payment.cancelledMessage")}
        descriptionClassName="max-w-md mx-auto"
        className="py-0"
      />
      <div className="flex items-center gap-2 text-primary font-medium text-sm animate-bounce">
        <span>{t("common.redirecting", "Redirection...")}</span>
      </div>
    </div>
  );
};

export default CancelPage;
