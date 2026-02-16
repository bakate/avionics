/**
 * Search form component for flight search.
 * Requirements: 1.1, 1.4, 6.1
 */
import { ArrowRightLeft, Search } from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useId,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  cabinOptions,
  type FormErrors,
  type FormState,
  initialFormState,
  type SearchFormProps,
  validateForm,
} from "./types";

const inputClass = (hasError: boolean) =>
  `h-12 w-full rounded-xl border px-4 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
    hasError
      ? "border-red-400/50 bg-red-50/50 text-red-900 placeholder:text-red-300"
      : "border-white/20 bg-white/10 text-white placeholder:text-slate-400 focus:bg-white/20"
  } backdrop-blur-sm`;

const FieldWrapper = ({
  children,
  error,
  label,
  htmlFor,
  className = "",
}: {
  children: ReactNode;
  label: string;
  htmlFor: string;
  error?: string | undefined;
  className?: string | undefined;
}) => (
  <div className={className}>
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300"
    >
      {label}
    </label>
    {children}
    {error && (
      <p
        className="mt-1.5 text-xs font-medium text-red-300 drop-shadow-sm"
        role="alert"
      >
        {error}
      </p>
    )}
  </div>
);

export const SearchForm = ({ onSearch, isLoading }: SearchFormProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});

  const originId = useId();
  const destId = useId();
  const depId = useId();
  const retId = useId();
  const passId = useId();
  const cabinId = useId();

  const updateField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const handleSwap = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      origin: prev.destination,
      destination: prev.origin,
    }));
    setErrors({});
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const result = validateForm(form, t as (key: string) => string);
      if (result.ok) {
        setErrors({});
        onSearch(result.params);
      } else {
        setErrors(result.errors);
      }
    },
    [form, onSearch, t],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="group relative w-full overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl md:p-8"
      noValidate
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <FieldWrapper
          label={t("search.origin")}
          error={errors.origin}
          className="flex-1"
          htmlFor={originId}
        >
          <input
            id={originId}
            type="text"
            placeholder="CDG"
            maxLength={3}
            value={form.origin}
            onChange={(e) =>
              updateField("origin", e.target.value.toUpperCase())
            }
            className={inputClass(Boolean(errors.origin))}
            aria-invalid={Boolean(errors.origin)}
          />
        </FieldWrapper>
        <div className="flex items-center justify-center md:pt-6">
          <button
            type="button"
            onClick={handleSwap}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white shadow-lg transition-all hover:bg-white/10 hover:rotate-180 md:h-12 md:w-12"
            aria-label={t("search.swap")}
          >
            <ArrowRightLeft className="h-5 w-5" />
          </button>
        </div>
        <FieldWrapper
          label={t("search.destination")}
          error={errors.destination}
          className="flex-1"
          htmlFor={destId}
        >
          <input
            id={destId}
            type="text"
            placeholder="JFK"
            maxLength={3}
            value={form.destination}
            onChange={(e) =>
              updateField("destination", e.target.value.toUpperCase())
            }
            className={inputClass(Boolean(errors.destination))}
            aria-invalid={Boolean(errors.destination)}
          />
        </FieldWrapper>
      </div>
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start">
        <FieldWrapper
          label={t("search.departureDate")}
          error={errors.departureDate}
          className="flex-1"
          htmlFor={depId}
        >
          <input
            id={depId}
            type="date"
            value={form.departureDate}
            onChange={(e) => updateField("departureDate", e.target.value)}
            className={inputClass(Boolean(errors.departureDate))}
            aria-invalid={Boolean(errors.departureDate)}
          />
        </FieldWrapper>
        <FieldWrapper
          label={t("search.returnDate")}
          error={errors.returnDate}
          className="flex-1"
          htmlFor={retId}
        >
          <input
            id={retId}
            type="date"
            value={form.returnDate}
            onChange={(e) => updateField("returnDate", e.target.value)}
            className={inputClass(Boolean(errors.returnDate))}
            aria-invalid={Boolean(errors.returnDate)}
          />
        </FieldWrapper>
        <FieldWrapper
          label={t("search.passengers")}
          error={errors.passengerCount}
          className="w-full md:w-32"
          htmlFor={passId}
        >
          <input
            id={passId}
            type="number"
            min={1}
            max={9}
            value={form.passengerCount}
            onChange={(e) =>
              updateField(
                "passengerCount",
                Number.parseInt(e.target.value, 10) || 1,
              )
            }
            className={inputClass(Boolean(errors.passengerCount))}
            aria-invalid={Boolean(errors.passengerCount)}
          />
        </FieldWrapper>
        <FieldWrapper
          label={t("search.cabinClass")}
          error={errors.cabinClass}
          className="w-full md:w-44"
          htmlFor={cabinId}
        >
          <select
            id={cabinId}
            value={form.cabinClass}
            onChange={(e) => updateField("cabinClass", e.target.value)}
            className={inputClass(Boolean(errors.cabinClass))}
            aria-invalid={Boolean(errors.cabinClass)}
          >
            {cabinOptions.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                className="bg-slate-900 text-white"
              >
                {opt.label}
              </option>
            ))}
          </select>
        </FieldWrapper>
      </div>
      <div className="mt-8 flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="flex h-12 min-w-[160px] items-center justify-center gap-3 rounded-xl bg-blue-600 px-8 text-sm font-bold tracking-wide text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-500 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Search className="h-5 w-5" />
          )}
          {t("search.submit").toUpperCase()}
        </button>
      </div>
    </form>
  );
};
