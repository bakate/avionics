import { effectTsResolver } from "@hookform/resolvers/effect-ts";
import {
  Calendar01Icon,
  Exchange01Icon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { useTransition } from "react";
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

export const SearchForm = ({ onSearch, isLoading }: SearchFormProps) => {
  const { t, i18n } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const form = useForm<SearchFormInput, unknown, SearchFormValues>({
    resolver: effectTsResolver(searchFormSchema),
    defaultValues: initialFormState,
  });

  const tripType = useWatch({ control: form.control, name: "tripType" });
  const isRoundTrip = tripType === "roundTrip";
  const busy = isLoading || isPending;

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

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="relative w-full overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-6 shadow-2xl shadow-primary/5 backdrop-blur-xl md:rounded-3xl md:p-8"
    >
      {/* Subtle top accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-accent to-transparent" />
      {/* Trip Type Toggle */}
      <Controller
        control={form.control}
        name="tripType"
        render={({ field }) => (
          <div
            className="mb-6 flex gap-1.5"
            role="radiogroup"
            aria-label={t("search.tripType")}
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                field.onChange("roundTrip");
                if (field.value === "oneWay") {
                  form.setValue("returnDate", "");
                }
              }}
              disabled={busy}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-semibold transition-all",
                field.value === "roundTrip"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              aria-pressed={field.value === "roundTrip"}
            >
              {t("search.roundTrip")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                field.onChange("oneWay");
                form.setValue("returnDate", "");
              }}
              disabled={busy}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-semibold transition-all",
                field.value === "oneWay"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              aria-pressed={field.value === "oneWay"}
            >
              {t("search.oneWay")}
            </Button>
          </div>
        )}
      />

      {/* Origin / Destination */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <Controller
          control={form.control}
          name="origin"
          render={({ field, fieldState }) => (
            <Field className="flex-1" data-invalid={fieldState.invalid}>
              <FieldLabel>{t("search.origin").toUpperCase()}</FieldLabel>
              <AirportAutocomplete
                value={field.value}
                onChange={field.onChange}
                placeholder="CDG"
                disabled={busy}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="flex items-center justify-center md:pt-8">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSwap}
            disabled={busy}
            aria-label={t("search.swap")}
            className="flex size-10 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-all hover:border-accent hover:bg-accent/10 hover:text-accent-foreground active:scale-95"
          >
            <HugeiconsIcon icon={Exchange01Icon} size={20} />
          </Button>
        </div>

        <Controller
          control={form.control}
          name="destination"
          render={({ field, fieldState }) => (
            <Field className="flex-1" data-invalid={fieldState.invalid}>
              <FieldLabel>{t("search.destination").toUpperCase()}</FieldLabel>
              <AirportAutocomplete
                value={field.value}
                onChange={field.onChange}
                placeholder="LHR"
                disabled={busy}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </div>

      {/* Dates + Passengers + Cabin */}
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start">
        {/* Date Picker - Range for round-trip, single for one-way */}
        <Field className="flex-1">
          <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {(t("search.dates") || "Dates").toUpperCase()}
          </FieldLabel>
          <Controller
            control={form.control}
            name="departureDate"
            render={({ field: departureField }) => (
              <Controller
                control={form.control}
                name="returnDate"
                render={({ field: returnField }) => {
                  if (isRoundTrip) {
                    const dateRange: DateRange = {
                      from: departureField.value
                        ? new Date(departureField.value)
                        : undefined,
                      to: returnField.value
                        ? new Date(returnField.value)
                        : undefined,
                    };

                    return (
                      <Popover>
                        <PopoverTrigger
                          render={
                            <Button
                              variant="outline"
                              className={cn(
                                "h-12 w-full justify-start rounded-xl border-border/60 bg-secondary/50 px-4 text-left font-semibold text-foreground hover:bg-secondary",
                                !dateRange.from && "text-muted-foreground/50",
                              )}
                              disabled={busy}
                            >
                              <HugeiconsIcon
                                icon={Calendar01Icon}
                                size={20}
                                className="mr-2text-muted-foreground"
                              />
                              {dateRange.from ? (
                                dateRange.to ? (
                                  <>
                                    {formatDate(dateRange.from)} -{" "}
                                    {formatDate(dateRange.to)}
                                  </>
                                ) : (
                                  formatDate(dateRange.from)
                                )
                              ) : (
                                <span>{t("search.selectDates")}</span>
                              )}
                            </Button>
                          }
                        />
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            autoFocus
                            mode="range"
                            defaultMonth={dateRange.from ?? new Date()}
                            selected={dateRange}
                            locale={i18n.language === "fr" ? fr : enUS}
                            onSelect={(range) => {
                              departureField.onChange(
                                range?.from ? toISODate(range.from) : "",
                              );
                              returnField.onChange(
                                range?.to ? toISODate(range.to) : "",
                              );
                            }}
                            numberOfMonths={2}
                          />
                          <FieldError
                            errors={[
                              form.formState.errors.departureDate,
                              form.formState.errors.returnDate,
                            ]}
                          />
                        </PopoverContent>
                      </Popover>
                    );
                  }

                  // One-way: single date picker
                  const selectedDate = departureField.value
                    ? new Date(departureField.value)
                    : undefined;

                  return (
                    <Popover>
                      <PopoverTrigger
                        render={
                          <Button
                            variant="outline"
                            className={cn(
                              "h-12 w-full justify-start rounded-xl border-border/60 bg-secondary/50 px-4 text-left font-semibold text-foreground hover:bg-secondary",
                              !selectedDate && "text-muted-foreground/50",
                            )}
                            disabled={busy}
                          >
                            <HugeiconsIcon
                              icon={Calendar01Icon}
                              size={20}
                              className="mr-2 text-muted-foreground"
                            />
                            {selectedDate ? (
                              formatDate(selectedDate)
                            ) : (
                              <span>{t("search.selectDeparture")}</span>
                            )}
                          </Button>
                        }
                      />
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          autoFocus
                          mode="single"
                          defaultMonth={selectedDate ?? new Date()}
                          selected={selectedDate}
                          onSelect={(date) => {
                            departureField.onChange(
                              date ? toISODate(date) : "",
                            );
                          }}
                        />
                        <FieldError
                          errors={[form.formState.errors.departureDate]}
                        />
                      </PopoverContent>
                    </Popover>
                  );
                }}
              />
            )}
          />
        </Field>

        {/* Structured Passenger Counter */}
        <Field className="flex-1">
          <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("search.passengers").toUpperCase()}
          </FieldLabel>
          <Controller
            control={form.control}
            name="passengers"
            render={({ field, fieldState }) => {
              const total =
                field.value.adults + field.value.children + field.value.infants;
              return (
                <>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          className="h-12 w-full  md:w-64 justify-start rounded-xl border-border/60 bg-secondary/50 px-4 text-left font-semibold text-foreground hover:bg-secondary"
                          disabled={busy}
                        >
                          <HugeiconsIcon
                            icon={UserIcon}
                            size={20}
                            className="mr-2 text-muted-foreground"
                          />
                          {t("search.passengersCount", { count: total })}
                        </Button>
                      }
                    />
                    <PopoverContent
                      className="w-auto md:w-64 rounded-xl"
                      align="start"
                    >
                      <div className="flex flex-col gap-1">
                        <PassengerCounter
                          label={t("search.adults", {
                            count: field.value.adults,
                          })}
                          value={field.value.adults}
                          min={1}
                          max={9}
                          onChange={(v) =>
                            field.onChange({ ...field.value, adults: v })
                          }
                          disabled={busy}
                        />
                        <PassengerCounter
                          label={t("search.children", {
                            count: field.value.children,
                          })}
                          value={field.value.children}
                          min={0}
                          max={8}
                          onChange={(v) =>
                            field.onChange({ ...field.value, children: v })
                          }
                          disabled={busy}
                        />
                        <PassengerCounter
                          label={t("search.infants", {
                            count: field.value.infants,
                          })}
                          value={field.value.infants}
                          min={0}
                          max={4}
                          onChange={(v) =>
                            field.onChange({ ...field.value, infants: v })
                          }
                          disabled={busy}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                  <FieldError errors={[fieldState.error]} />
                </>
              );
            }}
          />
        </Field>

        {/* Cabin Class */}
        <Controller
          control={form.control}
          name="cabinClass"
          render={({ field, fieldState }) => (
            <Field className="flex-1" data-invalid={fieldState.invalid}>
              <FieldLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("search.cabinClass").toUpperCase()}
              </FieldLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ?? "ALL"}
                disabled={busy}
              >
                <SelectTrigger className="h-12 w-full md:w-64 rounded-xl border-border/60 bg-secondary/50 px-4 font-semibold text-foreground hover:bg-secondary">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent className="w-full md:w-64">
                  {cabinOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </div>

      {/* Submit */}
      <div className="mt-8 flex justify-end">
        <Button
          type="submit"
          size="huge"
          disabled={busy}
          className="font-bold active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <span className="size-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : (
            <HugeiconsIcon icon={Search01Icon} size={20} />
          )}
          {t("search.submit").toUpperCase()}
        </Button>
      </div>
    </form>
  );
};
