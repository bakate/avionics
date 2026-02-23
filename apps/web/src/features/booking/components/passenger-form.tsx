import { Calendar01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { formatDate } from "../../../lib/format";
import { type PassengerInputEncoded } from "../schemas/passenger.schema";

export type PassengerFormProps = {
  readonly index: number;
  readonly type: PassengerType;
  readonly control: Control<{ passengers: Array<PassengerInputEncoded> }>;
};

export const PassengerForm = ({ index, type, control }: PassengerFormProps) => {
  const { t, i18n } = useTranslation();

  const titleKey =
    type === "ADULT"
      ? "search.adults"
      : type === "CHILD"
        ? "search.children"
        : "search.infants";

  return (
    <SectionCard
      title={t("passengers.passenger_number", { count: index + 1 } as Record<
        string,
        unknown
      >)}
      description={t(titleKey)}
    >
      {/* <div className="flex flex-col space-y-1.5 p-6 border-b border-border/10 bg-muted/20">
        <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
          <div className="bg-primary/10 p-1.5 rounded-full text-primary flex items-center justify-center">
             <HugeiconsIcon icon={UserIcon} size={16} />
          </div>
          {t("passengers.passenger_number", { count: index + 1 } as Record<string, unknown>)} •{" "}
          <span className="text-muted-foreground font-normal text-sm capitalize">
            {t(titleKey)}
          </span>
        </h3>
      </div> */}

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
                  <SelectValue placeholder={t("passengers.select_gender")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">
                    {t("passengers.genderTypes.male", "Male")}
                  </SelectItem>
                  <SelectItem value="FEMALE">
                    {t("passengers.genderTypes.female", "Female")}
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
