import { FilledStar } from "./social-proof-avatars";

type TestimonialCardProps = {
  readonly quote: string;
  readonly author: string;
  readonly role: string;
  readonly avatarIndex: number;
};

export const TestimonialCard = ({
  quote,
  author,
  role,
  avatarIndex,
}: TestimonialCardProps) => (
  <div className="flex flex-col gap-6 rounded-[2rem] border border-slate-100 bg-white p-8 dark:border-slate-800/60 dark:bg-slate-900/50 hover:shadow-lg transition-shadow duration-300">
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((starIndex) => (
        <FilledStar key={starIndex} size={14} />
      ))}
    </div>
    <p className="text-sm leading-relaxed text-slate-600 italic dark:text-slate-300">
      &ldquo;{quote}&rdquo;
    </p>
    <div className="flex items-center gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
      <div
        className="size-10 rounded-full bg-slate-200 shrink-0"
        style={{
          backgroundImage: `url(https://i.pravatar.cc/40?img=${avatarIndex})`,
          backgroundSize: "cover",
        }}
        aria-hidden="true"
      />
      <div className="flex flex-col">
        <span className="text-sm font-bold text-slate-900 dark:text-white">
          {author}
        </span>
        <span className="text-xs text-slate-400">{role}</span>
      </div>
    </div>
  </div>
);
