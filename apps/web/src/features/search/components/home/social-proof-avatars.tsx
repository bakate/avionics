import { useTranslation } from "react-i18next";

export const FilledStar = ({ size = 14 }: { readonly size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className="text-yellow-400"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

interface SocialProofAvatarsProps {
  readonly count: number;
}

export const SocialProofAvatars = ({ count }: SocialProofAvatarsProps) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {[10, 20, 30, 40].map((avatarSeed) => (
          <div
            key={avatarSeed}
            className="size-8 rounded-full border-2 border-white/30 bg-linear-to-br from-slate-400 to-slate-600"
            style={{
              backgroundImage: `url(https://i.pravatar.cc/32?img=${avatarSeed})`,
              backgroundSize: "cover",
            }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((starIndex) => (
            <FilledStar key={starIndex} size={10} />
          ))}
        </div>
        <span className="text-[10px] text-white/60 font-medium">
          {t("home.socialProof", { count })}
        </span>
      </div>
    </div>
  );
};
