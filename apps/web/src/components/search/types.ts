import { CabinClass } from "@workspace/domain/kernel";
import { SearchParams } from "../../schemas/search.schema";

export const searchFormSchema = SearchParams;

export type SearchFormValues = typeof SearchParams.Type;
export type SearchFormInput = typeof SearchParams.Encoded;

export type SearchFormProps = {
  readonly onSearch: (params: SearchFormValues) => void;
  readonly isLoading: boolean;
};

export const cabinOptions = [
  { value: "ALL", label: "—" },
  { value: CabinClass.ECONOMY, label: "Economy" },
  { value: CabinClass.BUSINESS, label: "Business" },
  { value: CabinClass.FIRST, label: "First" },
] as const;

export const initialFormState: SearchFormInput = {
  origin: "CDG",
  destination: "LHR",
  departureDate: new Date().toISOString().split("T")[0] ?? "",
  returnDate: "",
  passengerCount: "1",
  cabinClass: CabinClass.ECONOMY,
};
