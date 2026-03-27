import { Airplane01Icon, City01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as Autocomplete from "@workspace/ui/components/reui/autocomplete";
import { Effect } from "effect";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Airport, searchAirports } from "../lib/airport-service";

interface AirportAutocompleteProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
  readonly disabled?: boolean;
}

export const AirportAutocomplete = ({
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: AirportAutocompleteProps) => {
  const { i18n, t } = useTranslation();
  const locale = i18n.language;
  const isEn = locale.startsWith("en");

  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<ReadonlyArray<Airport>>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync internal query when external value changes (e.g. swap button)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.length >= 2) {
        setLoading(true);
        Effect.runPromise(searchAirports(query, locale))
          .then(setSuggestions)
          .catch((err) => {
            console.error("Search failed:", err);
            setSuggestions([]);
          })
          .finally(() => setLoading(false));
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, locale]);

  return (
    <Autocomplete.Autocomplete
      open={open}
      onOpenChange={setOpen}
      value={value}
      onValueChange={(val) => {
        onChange(val);
        setQuery(val);
        setOpen(false);
      }}
    >
      <Autocomplete.AutocompleteInput
        value={query}
        onInput={(e) => {
          const val = (e.target as HTMLInputElement).value;
          setQuery(val);
          if (val.length >= 2) setOpen(true);
        }}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
      <Autocomplete.AutocompleteContent>
        <Autocomplete.AutocompleteList>
          {suggestions.map((airport) => (
            <Autocomplete.AutocompleteItem
              key={airport.iata + (airport.icao ?? "")}
              value={airport.iata}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50">
                    <HugeiconsIcon
                      icon={airport.isMetroGroup ? City01Icon : Airplane01Icon}
                      size={14}
                      className="text-muted-foreground"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">
                      {isEn ? airport.nameEn : airport.nameFr}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {isEn ? airport.cityEn : airport.cityFr},{" "}
                      {airport.country}
                    </span>
                  </div>
                </div>
                {airport.iata && (
                  <span className="text-xs font-bold text-accent">
                    {airport.iata}
                  </span>
                )}
              </div>
            </Autocomplete.AutocompleteItem>
          ))}
          {loading && (
            <Autocomplete.AutocompleteEmpty>
              {t("search.airportSearching")}
            </Autocomplete.AutocompleteEmpty>
          )}
          {!loading && suggestions.length === 0 && query.length >= 2 && (
            <Autocomplete.AutocompleteEmpty>
              {t("search.noAirportsFound")}
            </Autocomplete.AutocompleteEmpty>
          )}
        </Autocomplete.AutocompleteList>
      </Autocomplete.AutocompleteContent>
    </Autocomplete.Autocomplete>
  );
};
