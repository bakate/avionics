import {
  Airplane01Icon,
  Calendar01Icon,
  PassportIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { ROUTES } from "../../../routes";
import { useBookingMachine } from "../hooks/use-booking-machine";

export const SummaryScreen = () => {
  const { is, send, context } = useBookingMachine();
  const { t } = useTranslation();

  // Redirect to start if missing data
  if (
    !context.searchParams ||
    !context.selectedOutbound ||
    context.passengers.length === 0
  ) {
    return <Navigate to={ROUTES.home} />;
  }

  const handlePayment = () => {
    send({ type: "CONFIRM_PAYMENT" });
  };

  // State calculations
  const outboundFlight = context.selectedOutbound.flight;
  const outboundPrice = context.selectedOutbound.price;
  const returnFlight = context.selectedReturn?.flight;
  const returnPrice = context.selectedReturn?.price;

  const totalAmount =
    (outboundPrice.amount + (returnPrice?.amount || 0)) *
    context.passengers.length;

  const formattedOutboundDate = new Date(
    outboundFlight.departureTime,
  ).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formattedReturnDate = returnFlight
    ? new Date(returnFlight.departureTime).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-6xl py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-3">
          {t("payment.title", "Review your journey")}
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          {t(
            "payment.subtitle",
            "Please verify your flight details and passenger information before proceeding to payment.",
          )}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-8">
          {/* Outbound Flight */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-full text-blue-700">
                <HugeiconsIcon
                  icon={Airplane01Icon}
                  size={20}
                  className="rotate-45"
                />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {t("payment.outboundFlight", "Outbound Flight")}
                </CardTitle>
                <div className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
                  <HugeiconsIcon icon={Calendar01Icon} size={14} />
                  {formattedOutboundDate}
                </div>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {new Date(
                          outboundFlight.departureTime,
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-sm font-medium text-slate-500">
                        {outboundFlight.origin}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center relative px-4">
                      <div className="w-full h-px bg-slate-300 absolute top-1/2 -translate-y-1/2"></div>
                      <div className="bg-white z-10 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider rounded-full border border-slate-200">
                        {outboundFlight.durationMinutes}m
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {new Date(
                          outboundFlight.arrivalTime,
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-sm font-medium text-slate-500">
                        {outboundFlight.destination}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="sm:border-l sm:pl-6 flex flex-col sm:items-end w-full sm:w-auto">
                  <div className="text-sm text-slate-500 mb-1">
                    {t("payment.cabin", "Cabin")}
                  </div>
                  <div className="font-semibold text-slate-900 capitalize">
                    {context.selectedOutbound.cabin.toLowerCase()}
                  </div>
                  <div className="text-sm text-slate-500 mt-2 mb-1">
                    {t("payment.flight", "Flight")}
                  </div>
                  <div className="font-semibold text-slate-900">
                    {outboundFlight.flightNumber}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Return Flight */}
          {returnFlight && formattedReturnDate && (
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-full text-blue-700">
                  <HugeiconsIcon
                    icon={Airplane01Icon}
                    size={20}
                    className="-rotate-135"
                  />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {t("payment.returnFlight", "Return Flight")}
                  </CardTitle>
                  <div className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <HugeiconsIcon icon={Calendar01Icon} size={14} />
                    {formattedReturnDate}
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {new Date(
                            returnFlight.departureTime,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="text-sm font-medium text-slate-500">
                          {returnFlight.origin}
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center relative px-4">
                        <div className="w-full h-px bg-slate-300 absolute top-1/2 -translate-y-1/2"></div>
                        <div className="bg-white z-10 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider rounded-full border border-slate-200">
                          {returnFlight.durationMinutes}m
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {new Date(
                            returnFlight.arrivalTime,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="text-sm font-medium text-slate-500">
                          {returnFlight.destination}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="sm:border-l sm:pl-6 flex flex-col sm:items-end w-full sm:w-auto">
                    <div className="text-sm text-slate-500 mb-1">
                      {t("payment.cabin", "Cabin")}
                    </div>
                    <div className="font-semibold text-slate-900 capitalize">
                      {context.selectedReturn?.cabin.toLowerCase()}
                    </div>
                    <div className="text-sm text-slate-500 mt-2 mb-1">
                      {t("payment.flight", "Flight")}
                    </div>
                    <div className="font-semibold text-slate-900">
                      {returnFlight.flightNumber}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Passengers */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-full text-emerald-700">
                <HugeiconsIcon icon={UserIcon} size={20} />
              </div>
              <CardTitle className="text-lg">
                {t("payment.passengersLabel", "Passengers")}
              </CardTitle>
            </div>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {context.passengers.map((p, idx) => (
                  <li key={idx} className="p-6 flex items-start gap-4">
                    <div className="bg-slate-100 p-3 rounded-full text-slate-400 mt-1">
                      <HugeiconsIcon icon={PassportIcon} size={24} />
                    </div>
                    <div>
                      <div className="font-bold text-lg text-slate-900">
                        {p.firstName} {p.lastName}
                      </div>
                      <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-2">
                        <span>
                          <span className="font-medium text-slate-600">
                            {t("passengers.gender", "Gender")}:
                          </span>{" "}
                          {t(
                            `passengers.genderTypes.${p.gender.toLowerCase()}`,
                            p.gender,
                          )}
                        </span>
                        <span>
                          <span className="font-medium text-slate-600">
                            {t("passengers.dob", "DOB")}:
                          </span>{" "}
                          {new Date(p.dateOfBirth).toLocaleDateString()}
                        </span>
                        <span>
                          <span className="font-medium text-slate-600">
                            {t("passengers.emailLabel", "Email")}:
                          </span>{" "}
                          {p.email}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-[380px]">
          <div className="sticky top-8">
            <Card className="border-slate-200 shadow-md">
              <CardHeader className="bg-slate-900 text-white rounded-t-xl pb-6">
                <CardTitle className="text-xl">
                  {t("payment.priceSummary", "Price Summary")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 -mt-2 bg-white rounded-b-xl">
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>{t("payment.passengersLabel", "Passengers")}</span>
                    <span className="font-medium">
                      {context.passengers.length} ×
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span>
                      {t("payment.outboundFlight", "Outbound Flight")}
                    </span>
                    <span className="font-medium">
                      {outboundPrice.amount} {outboundPrice.currency}
                    </span>
                  </div>

                  {returnFlight && returnPrice && (
                    <div className="flex justify-between items-center text-slate-600">
                      <span>{t("payment.returnFlight", "Return Flight")}</span>
                      <span className="font-medium">
                        {returnPrice.amount} {returnPrice.currency}
                      </span>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 mt-4">
                    <div className="flex justify-between items-end">
                      <span className="text-lg font-bold text-slate-900">
                        {t("payment.totalPrice", "Total Price")}
                      </span>
                      <span className="text-3xl font-black text-blue-600 tracking-tight">
                        {totalAmount}{" "}
                        <span className="text-xl">
                          {outboundPrice.currency}
                        </span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 text-right mt-1">
                      {t(
                        "payment.taxesIncluded",
                        "Includes all taxes and fees",
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <Button
                    size="lg"
                    className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                    onClick={handlePayment}
                    disabled={is("paying")}
                  >
                    {is("paying") ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        {t("payment.processing", "Processing...")}
                      </span>
                    ) : (
                      t("payment.confirm", "Proceed to Payment")
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-12"
                    type="button"
                    onClick={() => send({ type: "BACK" })}
                    disabled={is("paying")}
                  >
                    {t("passengers.back", "Go Back")}
                  </Button>
                </div>

                {context.error && (
                  <div className="mt-6 p-4 rounded-lg bg-red-50 text-red-600 border border-red-100 text-sm flex items-start gap-3">
                    <svg
                      className="w-5 h-5 shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>{context.error}</div>
                  </div>
                )}

                <div className="mt-6 text-center">
                  <div className="inline-flex items-center gap-2 text-xs text-slate-400 font-medium">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    {t(
                      "payment.securePayment",
                      "Secure payment powered by Polar",
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
