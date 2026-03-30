import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { useTranslation } from "react-i18next";

type DestinationCardProps = {
  readonly city: string;
  readonly country: string;
  readonly price: string;
  readonly image: string;
  readonly code: string;
  readonly promo?: string;
  readonly onSelect?: (code: string) => void;
};

export const DestinationCard = ({
  city,
  country,
  price,
  image,
  code,
  promo,
  onSelect,
}: DestinationCardProps) => {
  const { t } = useTranslation();

  const handleSelect = () => {
    onSelect?.(code);
    // Optionnel : remonter en haut de page pour voir le formulaire
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="group relative h-[480px] overflow-hidden rounded-[2.5rem] bg-slate-100 shadow-2xl shadow-slate-200/50 transition-all duration-700 hover:-translate-y-4 hover:shadow-royal-blue/10 dark:bg-slate-900 dark:shadow-none">
      {/* Background Image */}
      <img
        src={image}
        alt={`${city}, ${country}`}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
      />

      {/* Overlays */}
      <div className="absolute inset-0 bg-linear-to-t from-royal-blue/90 via-royal-blue/20 to-transparent opacity-60 transition-opacity duration-700 group-hover:opacity-80" />

      {/* Badge Promo */}
      {promo ? (
        <div className="absolute top-10 left-10 rounded-full bg-royal-blue px-6 py-2.5 text-[10px] font-bold tracking-[0.2em] text-white uppercase shadow-2xl backdrop-blur-md animate-in fade-in zoom-in duration-700">
          {promo}
        </div>
      ) : null}

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-10">
        <div className="mb-2 text-[10px] font-bold tracking-[0.4em] text-white/70 uppercase">
          {country}
        </div>
        <h3 className="font-heading mb-8 text-5xl font-normal tracking-tight text-white transition-all duration-700 group-hover:translate-x-2">
          {city}
        </h3>

        <div className="flex items-end justify-between border-t border-white/10 pt-8">
          <div className="flex flex-col">
            <span className="mb-2 text-[10px] font-semibold tracking-[0.3em] text-white/50 uppercase">
              {t("home.destinations.from")}
            </span>
            <span className="text-4xl font-bold tracking-tighter text-white">
              {price}
            </span>
          </div>

          <Button
            type="button"
            onClick={handleSelect}
            size="icon"
            variant="ghost"
            aria-label={t("home.destinations.selectDestination")}
            className="group/btn relative size-12 rounded-full bg-white/10 p-0 text-white backdrop-blur-md ring-1 ring-white/20 transition-all duration-500 hover:scale-110 hover:bg-white hover:text-royal-blue hover:ring-white hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] active:scale-95"
          >
            <HugeiconsIcon
              icon={Search01Icon}
              size={22}
              className="transition-transform duration-500 group-hover/btn:scale-110"
            />
          </Button>
        </div>
      </div>
    </div>
  );
};
