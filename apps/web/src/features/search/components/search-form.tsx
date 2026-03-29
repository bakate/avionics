import { effectTsResolver } from "@hookform/resolvers/effect-ts";
import {
  Calendar01Icon,
  Exchange01Icon,
  Loading02Icon,
  MinusSignIcon,
  PlusSignIcon,
  Search01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import { useEffect, useTransition } from "react";
import { type DateRange } from "react-day-picker";
import { enUS, fr } from "react-day-picker/locale";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { formatDate, toISODate } from "@/lib/format";
import { AirportAutocomplete } from "./airport-autocomplete";
import {
  cabinOptions,
  initialFormState,
  type SearchFormInput,
  type SearchFormProps,
  type SearchFormValues,
  searchFormSchema,
} from "./types";

type PassengerCounterProps = {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
  readonly disabled: boolean;
};

const PassengerCounter = ({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: PassengerCounterProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`${t("search.removePassenger")} ${label}`}
          className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors  hover:bg-secondary hover:text-foreground disabled:opacity-30"
        >
          <HugeiconsIcon icon={MinusSignIcon} size={14} />
        </Button>
        <span className="w-6 text-center text-sm font-semibold text-foreground">
          {value}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`${t("search.addPassenger")} ${label}`}
          className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors  hover:bg-secondary hover:text-foreground disabled:opacity-30"
        >
          <HugeiconsIcon icon={PlusSignIcon} size={14} />
        </Button>
      </div>
    </div>
  );
};

export const SearchForm = ({
  onSearch,
  isLoading,
  defaultValues,
}: SearchFormProps) => {
  const { t, i18n } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const form = useForm<SearchFormInput, unknown, SearchFormValues>({
    resolver: effectTsResolver(searchFormSchema),
    defaultValues: { ...initialFormState, ...defaultValues },
  });

  const tripType = useWatch({ control: form.control, name: "tripType" });
  const isRoundTrip = tripType === "roundTrip";
  const busy = isLoading || isPending;

  // Update form when defaultValues changes (e.g. from DestinationCard)
  useEffect(() => {
    if (defaultValues) {
      form.reset(defaultValues);
    }
  }, [defaultValues, form]);

  const onSubmit = (values: SearchFormValues) => {
    startTransition(() => {
      onSearch(values);
    });
  };

  const handleSwap = () => {
    const origin = form.getValues("origin");
    const destination = form.getValues("destination");
    form.setValue("origin", destination);
    form.setValue("destination", origin);
  };

  const translateFormError = (message?: string) => {
    if (!message) return message;
    if (message.includes("matching the pattern"))
      return t("validation.invalidAirportCode");
    if (message.includes("at least 1 character"))
      return t("validation.required");
    if (message.includes("Return date is required"))
      return t("validation.returnDateRequired");
    return message;
  };

  const getTranslatedErrors = (
    errors: Array<{ message?: string } | undefined | null>,
  ) => {
    return errors.map((e) => {
      if (!e) return undefined;
      const { message, ...rest } = e;
      const translated = translateFormError(message);
      return translated ? { ...rest, message: translated } : rest;
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="relative w-full">
      <div className="flex flex-col gap-2">
        {/* Trip Type Toggle - Slimmer */}
        <Controller
          control={form.control}
          name="tripType"
          render={({ field }) => (
            <div
              className="flex gap-6 px-6 pb-2"
              role="radiogroup"
              aria-label={t("search.tripType")}
            >
              {[
                { id: "roundTrip", label: "search.roundTrip" },
                { id: "oneWay", label: "search.oneWay" },
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    field.onChange(type.id);
                    if (type.id === "oneWay") {
                      form.setValue("returnDate", "");
                    }
                  }}
                  disabled={busy}
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-[0.2em] transition-all",
                    field.value === type.id
                      ? "text-white"
                      : "text-white/40 hover:text-white/70",
                  )}
                >
                  {t(type.label as "search.roundTrip" | "search.oneWay")}
                </button>
              ))}
            </div>
          )}
        />

        {/* Main Integrated Bar Content (Outer container handled by Hub) */}
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          {/* Origin */}
          <div className="flex-1 px-8 py-6 transition-colors focus-within:bg-white/5 lg:border-r lg:border-white/10">
            <Controller
              control={form.control}
              name="origin"
              render={({ field, fieldState }) => (
                <Field className="group" data-invalid={fieldState.invalid}>
                  <FieldLabel className="mb-0 text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">
                    {t("search.origin")}
                  </FieldLabel>
                  <AirportAutocomplete
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="PAR"
                    disabled={busy}
                    className="h-auto border-none bg-transparent p-0 text-2xl font-black uppercase tracking-tighter text-white placeholder:text-white/40 focus-visible:ring-0"
                  />
                  <FieldError
                    errors={getTranslatedErrors([fieldState.error])}
                  />
                </Field>
              )}
            />
          </div>

          {/* Swap Button - Absolute/Integrated */}
          <div className="relative z-10 -my-4 flex items-center justify-center lg:my-0 lg:-mx-5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleSwap}
              disabled={busy}
              className="size-10 rounded-full border-white/10 bg-white/10 text-white shadow-xl backdrop-blur-md transition-all hover:scale-110 hover:bg-royal-blue"
            >
              <HugeiconsIcon icon={Exchange01Icon} size={18} />
            </Button>
          </div>

          {/* Destination */}
          <div className="flex-1 px-8 py-6 transition-colors focus-within:bg-white/5 lg:border-r lg:border-white/10">
            <Controller
              control={form.control}
              name="destination"
              render={({ field, fieldState }) => (
                <Field className="group" data-invalid={fieldState.invalid}>
                  <FieldLabel className="mb-0 text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">
                    {t("search.destination")}
                  </FieldLabel>
                  <AirportAutocomplete
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="TYO"
                    disabled={busy}
                    className="h-auto border-none bg-transparent p-0 text-2xl font-black uppercase tracking-tighter text-white placeholder:text-white/40 focus-visible:ring-0"
                  />
                  <FieldError
                    errors={getTranslatedErrors([fieldState.error])}
                  />
                </Field>
              )}
            />
          </div>

          {/* Dates */}
          <div className="flex-[1.2] px-8 py-6 transition-colors hover:bg-white/5 lg:border-r lg:border-white/10">
            <Controller
              control={form.control}
              name="departureDate"
              render={({ field: departureField }) => (
                <Controller
                  control={form.control}
                  name="returnDate"
                  render={({ field: returnField }) => {
                    const toDate = (val: string | undefined | null) =>
                      val ? new Date(val) : undefined;
                    const dateRange: DateRange = {
                      from: toDate(departureField.value),
                      to: isRoundTrip ? toDate(returnField.value) : undefined,
                    };

                    return (
                      <Popover>
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              className="group flex h-16 w-full cursor-pointer flex-col justify-center text-left transition-colors outline-none focus-visible:bg-white/5"
                            >
                              <span className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                                {t("search.dates")}
                              </span>
                              <div className="flex items-center gap-4">
                                <HugeiconsIcon
                                  icon={Calendar01Icon}
                                  size={18}
                                  className="text-royal-blue"
                                />
                                <span className="text-base font-bold text-white">
                                  {dateRange.from
                                    ? isRoundTrip && dateRange.to
                                      ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
                                      : formatDate(dateRange.from)
                                    : t("search.selectDates")}
                                </span>
                              </div>
                            </button>
                          }
                        />
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            autoFocus
                            mode={(isRoundTrip ? "range" : "single") as any}
                            defaultMonth={dateRange.from ?? new Date()}
                            selected={isRoundTrip ? dateRange : dateRange.from}
                            locale={i18n.language === "fr" ? fr : enUS}
                            onSelect={(val: any) => {
                              if (isRoundTrip) {
                                departureField.onChange(
                                  val?.from ? toISODate(val.from) : "",
                                );
                                returnField.onChange(
                                  val?.to ? toISODate(val.to) : "",
                                );
                              } else {
                                departureField.onChange(
                                  val ? toISODate(val) : "",
                                );
                              }
                            }}
                            numberOfMonths={isRoundTrip ? 2 : 1}
                          />
                        </PopoverContent>
                      </Popover>
                    );
                  }}
                />
              )}
            />
          </div>

          {/* Passengers & Cabin */}
          <div className="flex-1 px-8 py-6 transition-colors hover:bg-white/5 lg:border-r lg:border-white/10">
            <Controller
              control={form.control}
              name="passengers"
              render={({ field: pField }) => (
                <Controller
                  control={form.control}
                  name="cabinClass"
                  render={({ field: cField }) => {
                    const total =
                      pField.value.adults +
                      pField.value.children +
                      pField.value.infants;
                    const cabinLabel =
                      cabinOptions.find((o) => o.value === cField.value)
                        ?.label ?? "Economy";

                    return (
                      <Popover>
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              className="group flex h-full w-full flex-col text-left disabled:opacity-50"
                              disabled={busy}
                            >
                              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">
                                {t("search.passengers")} &{" "}
                                {t("search.cabinClass")}
                              </span>
                              <div className="flex items-center gap-2 pt-1 font-bold text-white">
                                <HugeiconsIcon
                                  icon={UserIcon}
                                  size={18}
                                  className="text-white/60 group-hover:text-white"
                                />
                                <span className="text-base tracking-tight">
                                  {total} PAX, {cabinLabel}
                                </span>
                              </div>
                            </button>
                          }
                        />
                        <PopoverContent
                          className="w-[320px] rounded-[2rem] p-6 shadow-2xl"
                          align="end"
                        >
                          <div className="space-y-6">
                            <div className="space-y-4">
                              <PassengerCounter
                                label={t("search.adults", {
                                  count: pField.value.adults,
                                })}
                                value={pField.value.adults}
                                min={1}
                                max={9}
                                onChange={(v) =>
                                  pField.onChange({
                                    ...pField.value,
                                    adults: v,
                                  })
                                }
                                disabled={busy}
                              />
                              <PassengerCounter
                                label={t("search.children", {
                                  count: pField.value.children,
                                })}
                                value={pField.value.children}
                                min={0}
                                max={8}
                                onChange={(v) =>
                                  pField.onChange({
                                    ...pField.value,
                                    children: v,
                                  })
                                }
                                disabled={busy}
                              />
                              <PassengerCounter
                                label={t("search.infants", {
                                  count: pField.value.infants,
                                })}
                                value={pField.value.infants}
                                min={0}
                                max={4}
                                onChange={(v) =>
                                  pField.onChange({
                                    ...pField.value,
                                    infants: v,
                                  })
                                }
                                disabled={busy}
                              />
                            </div>

                            <div className="border-t border-slate-100 pt-6 dark:border-white/10">
                              <span className="mb-4 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {t("search.cabinClass")}
                              </span>
                              <div className="grid grid-cols-1 gap-2">
                                {cabinOptions.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => cField.onChange(opt.value)}
                                    className={cn(
                                      "flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all",
                                      cField.value === opt.value
                                        ? "bg-royal-blue text-white"
                                        : "hover:bg-slate-50 dark:hover:bg-white/5",
                                    )}
                                  >
                                    {opt.label}
                                    {cField.value === opt.value && (
                                      <div className="size-1.5 rounded-full bg-white" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  }}
                />
              )}
            />
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-center p-4">
            <Button
              type="submit"
              disabled={busy}
              className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-royal-blue to-blue-800 p-0 text-white shadow-premium-shadow transition-all duration-500 hover:scale-105 hover:shadow-royal-blue/30 active:scale-95 disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-linear-to-tr from-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              {busy ? (
                <HugeiconsIcon
                  icon={Loading02Icon}
                  size={24}
                  className="animate-spin"
                />
              ) : (
                <HugeiconsIcon icon={Search01Icon} size={24} />
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
