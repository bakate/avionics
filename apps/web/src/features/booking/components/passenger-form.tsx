import { Calendar01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type PassengerInputEncoded } from "@workspace/application/booking-types";
import { type PassengerType } from "@workspace/domain/kernel";
import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { SectionCard } from "@workspace/ui/components/section-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import { enUS, fr } from "react-day-picker/locale";
import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/format";

export type PassengerFormProps = {
  readonly index: number;
  readonly type: PassengerType;
  readonly control: Control<{ passengers: Array<PassengerInputEncoded> }>;
};

const PASSENGER_TYPE_BADGE: Partial<
  Record<PassengerType, { label: string; classes: string }>
> = {
  ADULT: {
    label: "search.adults",
    classes: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  CHILD: {
    label: "search.children",
    classes:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  INFANT: {
    label: "search.infants",
    classes:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
};

export const PassengerForm = ({ index, type, control }: PassengerFormProps) => {
  const { t, i18n } = useTranslation();
  const badge = PASSENGER_TYPE_BADGE[type];

  return (
    <SectionCard
      title={t("passengers.passenger_number", { count: index + 1 } as Record<
        string,
        unknown
      >)}
      action={
        badge ? (
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full",
              badge.classes,
            )}
          >
            {(t as (k: string, o: Record<string, unknown>) => string)(
              badge.label,
              { count: 1 },
            )}
          </span>
        ) : null
      }
    >
      <div className="grid md:grid-cols-2 gap-6">
        <Controller
          control={control}
          name={
            `passengers.${index}.firstName` as `passengers.${number}.firstName`
          }
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>{t("passengers.first_name")}</FieldLabel>
              <Input placeholder="John" {...field} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name={
            `passengers.${index}.lastName` as `passengers.${number}.lastName`
          }
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>{t("passengers.last_name")}</FieldLabel>
              <Input placeholder="Doe" {...field} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name={`passengers.${index}.email` as `passengers.${number}.email`}
          render={({ field, fieldState }) => (
            <Field className="md:col-span-2">
              <FieldLabel>{t("passengers.email")}</FieldLabel>
              <Input
                type="email"
                placeholder="john.doe@example.com"
                {...field}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name={`passengers.${index}.gender` as `passengers.${number}.gender`}
          render={({ field, fieldState }) => (
            <Field className="flex flex-col flex-1">
              <FieldLabel>{t("passengers.gender")}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("passengers.select_gender")}>
                    {field.value === "MALE"
                      ? t("passengers.genderTypes.male")
                      : field.value === "FEMALE"
                        ? t("passengers.genderTypes.female")
                        : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">
                    {t("passengers.genderTypes.male")}
                  </SelectItem>
                  <SelectItem value="FEMALE">
                    {t("passengers.genderTypes.female")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name={
            `passengers.${index}.dateOfBirth` as `passengers.${number}.dateOfBirth`
          }
          render={({ field, fieldState }) => (
            <Field className="flex flex-col flex-1 mt-2 md:mt-0">
              <FieldLabel>{t("passengers.date_of_birth")}</FieldLabel>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground",
                      )}
                    />
                  }
                >
                  {field.value ? (
                    formatDate(new Date(field.value))
                  ) : (
                    <span>{t("passengers.pick_a_date")}</span>
                  )}
                  <HugeiconsIcon
                    icon={Calendar01Icon}
                    size={16}
                    className="ml-auto opacity-50"
                  />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    autoFocus
                    mode="single"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={(date) => field.onChange(date?.toISOString())}
                    className="rounded-lg border"
                    locale={i18n.language === "fr" ? fr : enUS}
                    captionLayout="dropdown"
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
                  />
                </PopoverContent>
              </Popover>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </div>
    </SectionCard>
  );
};
