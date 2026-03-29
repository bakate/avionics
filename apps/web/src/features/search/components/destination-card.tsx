import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
      <div className="absolute inset-x-0 bottom-0 p-12">
        <div className="mb-3 text-[10px] font-bold tracking-[0.4em] text-white/60 uppercase">
          {country}
        </div>
        <h3 className="font-heading mb-8 text-5xl font-normal tracking-tight text-white transition-all duration-700 group-hover:translate-x-2">
          {city}
        </h3>

        <div className="flex items-center justify-between border-t border-white/20 pt-8">
          <div className="flex flex-col">
            <span className="mb-2 text-[10px] font-semibold tracking-[0.3em] text-white/50 uppercase">
              {t("home.destinations.from")}
            </span>
            <span className="text-4xl font-bold tracking-tighter text-white">
              {price}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSelect}
            className="flex size-16 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-2xl ring-1 ring-white/30 transition-all duration-500 hover:cursor-pointer group-hover:scale-110 group-hover:bg-white group-hover:text-royal-blue group-hover:ring-white group-hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
          >
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={32}
              className="transition-transform duration-500 group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </div>
    </div>
  );
};
