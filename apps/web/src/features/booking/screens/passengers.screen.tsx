import { effectTsResolver } from "@hookform/resolvers/effect-ts";
import { type PassengerType } from "@workspace/domain/kernel";
import { Button } from "@workspace/ui/components/button";
import { Heading } from "@workspace/ui/components/heading";
import { Schema } from "effect";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { PassengerForm } from "@/features/booking/components/passenger-form";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import {
  PassengerInput,
  type PassengerInputEncoded,
} from "@/features/booking/schemas/passenger.schema";

const PassengersFormSchema = Schema.Struct({
  passengers: Schema.mutable(
    Schema.Array(PassengerInput).pipe(Schema.minItems(1)),
  ),
});

type PassengersFormValues = {
  passengers: Array<PassengerInputEncoded>;
};

export const PassengersScreen = () => {
  const { send, context } = useBookingMachine();
  const { t } = useTranslation();
  const searchParams = context.searchParams;

  const generateInitial = (): PassengersFormValues["passengers"] => {
    if (!searchParams) return [];

    const defaultValues: PassengersFormValues["passengers"] = [];

    // Adults
    for (
      let adultIndex = 0;
      adultIndex < searchParams.passengers.adults;
      adultIndex++
    ) {
      defaultValues.push({
        firstName: "",
        lastName: "",
        email: "",
        gender: "MALE",
        dateOfBirth: "1990-01-01T00:00:00.000Z",
      });
    }

    // Children
    for (
      let childIndex = 0;
      childIndex < searchParams.passengers.children;
      childIndex++
    ) {
      defaultValues.push({
        firstName: "",
        lastName: "",
        email: "",
        gender: "MALE",
        dateOfBirth: "2015-01-01T00:00:00.000Z",
      });
    }

    // Infants
    for (
      let infantIndex = 0;
      infantIndex < searchParams.passengers.infants;
      infantIndex++
    ) {
      defaultValues.push({
        firstName: "",
        lastName: "",
        email: "",
        gender: "MALE",
        dateOfBirth: "2023-01-01T00:00:00.000Z",
      });
    }

    return defaultValues;
  };

  const form = useForm<PassengersFormValues>({
    resolver: effectTsResolver(
      PassengersFormSchema,
    ) as unknown as import("react-hook-form").Resolver<PassengersFormValues>,
    defaultValues: {
      passengers:
        context.passengers.length > 0
          ? (context.passengers as unknown as PassengersFormValues["passengers"])
          : generateInitial(),
    },
    mode: "onBlur",
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "passengers",
  });

  const onSubmit = (data: PassengersFormValues) => {
    send({
      type: "SET_PASSENGERS",
      passengers: data.passengers as unknown as Array<PassengerInput>,
    });
  };

  const getPassengerTypeByIndex = (index: number): PassengerType => {
    if (!searchParams) return "ADULT";
    if (index < searchParams.passengers.adults) return "ADULT";
    if (
      index <
      searchParams.passengers.adults + searchParams.passengers.children
    )
      return "CHILD";
    return "INFANT";
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      <Heading
        title={t("passengers.title")}
        description={t("passengers.who_is_traveling")}
        className="mb-8"
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-4">
        <div className="space-y-6">
          {fields.map((field, index) => (
            <PassengerForm
              key={field.id}
              index={index}
              type={getPassengerTypeByIndex(index)}
              control={form.control}
            />
          ))}
        </div>

        <div className="flex justify-between items-center pt-6 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={() => send({ type: "BACK" })}
          >
            {t("passengers.back")}
          </Button>
          <Button type="submit" size="lg" className="px-8">
            {t("passengers.continue")}
          </Button>
        </div>
      </form>
    </div>
  );
};
