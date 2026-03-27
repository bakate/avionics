import { SearchParams } from "@workspace/application/booking-types";
import { CabinClass } from "@workspace/domain/kernel";

export const searchFormSchema = SearchParams;

export type SearchFormValues = typeof SearchParams.Type;
export type SearchFormInput = typeof SearchParams.Encoded;

export type SearchFormProps = {
  readonly onSearch: (params: SearchFormValues) => void;
  readonly isLoading: boolean;
  readonly defaultValues?: Partial<SearchFormInput> | undefined;
};

export const cabinOptions = [
  { value: CabinClass.ECONOMY, label: "Economy" },
  { value: CabinClass.BUSINESS, label: "Business" },
  { value: CabinClass.FIRST, label: "First" },
] as const;

export const initialFormState: SearchFormInput = {
  tripType: "roundTrip",
  origin: "",
  destination: "",
  departureDate: "",
  returnDate: "",
  passengers: { adults: 1, children: 0, infants: 0 },
  cabinClass: CabinClass.ECONOMY,
};
