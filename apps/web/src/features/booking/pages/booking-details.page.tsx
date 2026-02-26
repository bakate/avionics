import { type BookingSummary } from "@workspace/application/read-models";
import { Button } from "@workspace/ui/components/button";
import { Heading } from "@workspace/ui/components/heading";
import { Spinner } from "@workspace/ui/components/spinner";
import { Effect } from "effect";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { getBookingByPnr } from "@/api/booking.api";
import { BookingSummaryCard } from "@/features/booking/components/booking-summary";
import { ROUTES } from "@/routes";

export const BookingDetailsPage = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooking = () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Effect.runPromise(getBookingByPnr(id))
      .then(setBooking)
      .catch((e) => setError(e.message || "Failed to load booking"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchBooking();
  }, [id]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-8 flex items-center justify-between">
        <Heading
          title={t("booking.details.title", "Détails de la réservation")}
          description={t(
            "booking.details.subtitle",
            "Informations concernant votre voyage",
          )}
        />
        <Button variant="outline" onClick={() => navigate(ROUTES.home)}>
          {t("common.back", "Retour")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner className="size-8 text-primary" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
          <p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchBooking}>
            {t("common.retry", "Réessayer")}
          </Button>
        </div>
      ) : booking ? (
        <div className="mx-auto max-w-lg">
          <BookingSummaryCard booking={booking} onUpdate={fetchBooking} />
        </div>
      ) : null}
    </div>
  );
};
