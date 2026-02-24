import { Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type BookingSummary } from "@workspace/application/read-models";
import { Button } from "@workspace/ui/components/button";
import { Heading } from "@workspace/ui/components/heading";
import { type None } from "effect/Option";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import { BookingSummaryCard } from "@/features/booking/components/booking-summary";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import { ROUTES } from "@/routes";

export const ConfirmationScreen = () => {
  const { is, send, context } = useBookingMachine();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // If not confirmed, or missing bookingResult, redirect home
  if (!is("confirmed") || !context.bookingResult) {
    return <Navigate to={ROUTES.home} />;
  }

  const booking = context.bookingResult;

  // We need to map the BookingResult from the machine to a BookingSummary shape
  // for the BookingSummaryCard
  const summaryForCard: BookingSummary = {
    id: booking.bookingId as BookingSummary["id"],
    pnrCode: booking.pnrCode as BookingSummary["pnrCode"],
    status: booking.status as BookingSummary["status"],
    totalPrice: booking.totalPrice as BookingSummary["totalPrice"],
    createdAt: new Date(booking.confirmedAt),
    expiresAt: { _tag: "None" } as None<Date>,
    passengerCount: context.passengers.length,
  };

  return (
    <div className="mx-auto max-w-3xl py-12 px-4">
      <div className="flex flex-col items-center justify-center text-center mb-10">
        <div className="flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-6">
          <HugeiconsIcon icon={Tick01Icon} size={40} />
        </div>
        <Heading
          title={t("confirmation.successTitle")}
          description={t("confirmation.successMessage")}
        />
      </div>

      <div className="mb-10">
        <BookingSummaryCard booking={summaryForCard} />
      </div>

      <div className="flex justify-center gap-4">
        <Button
          size="lg"
          onClick={() => {
            send({ type: "RESET" });
            void navigate(ROUTES.home);
          }}
        >
          {t("confirmation.newBooking")}
        </Button>
      </div>
    </div>
  );
};
