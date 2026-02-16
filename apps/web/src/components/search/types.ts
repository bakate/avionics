import { CabinClass } from "@workspace/domain/kernel";
import { Schema } from "effect";
import {
  type SearchParams,
  SearchParams as SearchParamsSchema,
} from "../../schemas/search.schema.ts";

export type SearchFormProps = {
  readonly onSearch: (params: SearchParams) => void;
  readonly isLoading: boolean;
};

export type FormState = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  passengerCount: number;
  cabinClass: string;
};

export type FormErrors = Partial<Record<keyof FormState, string>>;

export const initialFormState: FormState = {
  origin: "",
  destination: "",
  departureDate: "",
  returnDate: "",
  passengerCount: 1,
  cabinClass: "",
};

export const cabinOptions = [
  { value: "", label: "—" },
  { value: CabinClass.ECONOMY, label: "Economy" },
  { value: CabinClass.BUSINESS, label: "Business" },
  { value: CabinClass.FIRST, label: "First" },
] as const;

export const validateForm = (
  form: FormState,
  t: (key: string) => string,
): { ok: true; params: SearchParams } | { ok: false; errors: FormErrors } => {
  const raw: Record<string, unknown> = {
    origin: form.origin.toUpperCase().trim(),
    destination: form.destination.toUpperCase().trim(),
    passengerCount: form.passengerCount,
  };
  if (form.departureDate) raw.departureDate = new Date(form.departureDate);
  if (form.returnDate) raw.returnDate = new Date(form.returnDate);
  if (form.cabinClass) raw.cabinClass = form.cabinClass;

  const result = Schema.decodeUnknownEither(SearchParamsSchema)(raw);

  if (result._tag === "Right") return { ok: true, params: result.right };

  const errors: FormErrors = {};
  if (!form.origin.trim()) errors.origin = t("validation.required");
  if (!form.destination.trim()) errors.destination = t("validation.required");
  if (!form.departureDate) errors.departureDate = t("validation.required");
  if (form.passengerCount < 1)
    errors.passengerCount = t("validation.minPassengers");
  if (form.passengerCount > 9)
    errors.passengerCount = t("validation.maxPassengers");

  return { ok: false, errors };
};
