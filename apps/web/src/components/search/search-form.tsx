import { effectTsResolver } from "@hookform/resolvers/effect-ts";
import {
  Calendar01Icon,
  Exchange01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
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
import { format } from "date-fns";
import { useTransition } from "react";
import { type DateRange } from "react-day-picker";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  cabinOptions,
  initialFormState,
  type SearchFormInput,
  type SearchFormProps,
  type SearchFormValues,
  searchFormSchema,
} from "./types";

export const SearchForm = ({ onSearch, isLoading }: SearchFormProps) => {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  const form = useForm<SearchFormInput, any, SearchFormValues>({
    resolver: effectTsResolver(searchFormSchema),
    defaultValues: initialFormState,
  });

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
      className="group relative w-full overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl md:p-8"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <Controller
          control={form.control}
          name="origin"
          render={({ field, fieldState }) => (
            <Field className="flex-1" data-invalid={fieldState.invalid}>
              <FieldLabel>{t("search.origin").toUpperCase()}</FieldLabel>
              <Input
                {...field}
                className="bg-white/5 border-white/10 font-semibold text-white placeholder:text-white/40 h-12"
                placeholder="CDG"
                maxLength={3}
                disabled={isLoading || isPending}
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
            disabled={isLoading || isPending}
            aria-label={t("search.swap")}
            className="flex size-12 text-white/70 hover:bg-white/10 hover:text-white"
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
              <Input
                {...field}
                className="bg-white/5 border-white/10 font-semibold text-white placeholder:text-white/40 h-12"
                placeholder="LHR"
                maxLength={3}
                disabled={isLoading || isPending}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </div>

      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start">
        <Field className="flex-1">
          <FieldLabel>
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
                            variant="ghost"
                            className={cn(
                              "h-12 w-full justify-start border-white/10 bg-white/5 px-4 text-left font-semibold text-white hover:bg-white/10",
                              !dateRange.from && "text-white/40",
                            )}
                            disabled={isLoading || isPending}
                          >
                            <HugeiconsIcon
                              icon={Calendar01Icon}
                              size={20}
                              className="mr-2 opacity-50"
                            />
                            {dateRange.from ? (
                              dateRange.to ? (
                                <>
                                  {format(dateRange.from, "LLL dd, y")} -{" "}
                                  {format(dateRange.to, "LLL dd, y")}
                                </>
                              ) : (
                                format(dateRange.from, "LLL dd, y")
                              )
                            ) : (
                              <span>
                                {t("search.selectDates") || "Select dates"}
                              </span>
                            )}
                          </Button>
                        }
                      />
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange.from ?? new Date()}
                          selected={dateRange}
                          onSelect={(range) => {
                            departureField.onChange(
                              range?.from?.toISOString().split("T")[0] ?? "",
                            );
                            returnField.onChange(
                              range?.to?.toISOString().split("T")[0] ?? "",
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
                }}
              />
            )}
          />
        </Field>

        <Controller
          control={form.control}
          name="cabinClass"
          render={({ field, fieldState }) => (
            <Field className="flex-1" data-invalid={fieldState.invalid}>
              <FieldLabel>{t("search.cabinClass").toUpperCase()}</FieldLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ?? "ALL"}
                disabled={isLoading || isPending}
              >
                <SelectTrigger className="!h-12 border-white/10 bg-white/5 font-semibold text-white hover:bg-white/10 w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
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

      <div className="mt-8 flex justify-end">
        <Button
          type="submit"
          size={"huge"}
          disabled={isLoading || isPending}
          className="rounded-2xl bg-blue-600 px-8 font-bold text-white shadow-xl transition-all hover:bg-blue-500 hover:shadow-blue-500/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading || isPending ? (
            <span className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <HugeiconsIcon icon={Search01Icon} size={20} />
          )}
          {t("search.submit").toUpperCase()}
        </Button>
      </div>
    </form>
  );
};
