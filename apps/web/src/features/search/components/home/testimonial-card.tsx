import { cn } from "@workspace/ui/lib/utils";
import { FilledStar } from "./social-proof-avatars";

type TestimonialCardProps = {
  readonly quote: string;
  readonly author: string;
  readonly role: string;
  readonly avatarIndex: number;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] || ""}${
      parts[parts.length - 1]?.[0] || ""
    }`.toUpperCase();
  }
  return (name[0] || "?").toUpperCase();
};

const getAvatarColor = (index: number) => {
  // Premium harmonic palette
  const colors = [
    "bg-royal-blue",
    "bg-indigo-600",
    "bg-slate-800",
    "bg-blue-700",
    "bg-sky-700",
  ];
  return colors[index % colors.length] || colors[0];
};

export const TestimonialCard = ({
  quote,
  author,
  role,
  avatarIndex,
}: TestimonialCardProps) => (
  <div className="grid grid-rows-subgrid row-span-3 gap-6 rounded-[2rem] border border-slate-100 bg-white p-8 dark:border-slate-800/60 dark:bg-slate-900/50 hover:shadow-lg transition-shadow duration-300">
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((starIndex) => (
        <FilledStar key={starIndex} size={14} />
      ))}
    </div>
    <p className="text-sm leading-relaxed text-slate-600 italic dark:text-slate-300">
      &ldquo;{quote}&rdquo;
    </p>
    <div className="flex items-center gap-3 border-t border-slate-100 pt-6 dark:border-slate-800 self-end">
      <div
        className={cn(
          "size-10 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-1 ring-white/10",
          getAvatarColor(avatarIndex),
        )}
        aria-hidden="true"
      >
        {getInitials(author)}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-slate-900 dark:text-white">
          {author}
        </span>
        <span className="text-xs text-slate-400">{role}</span>
      </div>
    </div>
  </div>
);
