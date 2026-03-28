import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslation } from "react-i18next";

type DestinationCardProps = {
  readonly city: string;
  readonly country: string;
  readonly price: string;
  readonly image: string;
  readonly promo?: string;
};

export const DestinationCard = ({
  city,
  country,
  price,
  image,
  promo,
}: DestinationCardProps) => {
  const { t } = useTranslation();

  return (
    <div className="group relative h-[400px] overflow-hidden rounded-[2rem] bg-slate-100 shadow-lg transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl dark:bg-slate-800">
      {/* Background Image */}
      <img
        src={image}
        alt={`${city}, ${country}`}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
      />

      {/* Overlays */}
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-90" />

      {/* Badge Promo */}
      {promo ? (
        <div className="absolute top-6 left-6 rounded-full bg-blue-600 px-4 py-1.5 text-[10px] font-bold tracking-widest text-white uppercase shadow-lg">
          {promo}
        </div>
      ) : null}

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-8">
        <div className="mb-1 text-xs font-bold tracking-widest text-white/70 uppercase">
          {country}
        </div>
        <h3 className="mb-4 text-3xl font-black text-white">{city}</h3>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-wider text-white/60 uppercase">
              {t("home.destinations.from")}
            </span>
            <span className="text-2xl font-black text-white">{price}</span>
          </div>

          <button
            type="button"
            className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all duration-300 group-hover:bg-white group-hover:text-blue-600"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};
