import { type SmartPhoneIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Heading } from "@workspace/ui/components/heading";

type ValueCardProps = {
  readonly tag: string;
  readonly icon: typeof SmartPhoneIcon;
  readonly title: string;
  readonly desc: string;
};

export const ValueCard = ({ tag, icon, title, desc }: ValueCardProps) => (
  <div className="group relative flex flex-col items-start rounded-[2rem] border border-slate-100 bg-white p-10 text-left transition-all duration-500 hover:-translate-y-2 hover:border-royal-blue/20 hover:shadow-[0_20px_60px_-15px_rgba(30,58,138,0.12)] dark:border-slate-800/60 dark:bg-slate-900/50 dark:hover:border-royal-blue/30 cursor-default">
    <div className="absolute inset-0 rounded-[2rem] bg-linear-to-br from-royal-blue/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

    <div className="relative mb-6 flex size-14 items-center justify-center rounded-2xl bg-royal-blue/8 text-royal-blue transition-all duration-500 group-hover:scale-110 group-hover:bg-royal-blue group-hover:text-white dark:bg-royal-blue/10">
      <HugeiconsIcon icon={icon} size={24} />
    </div>

    <span className="mb-3 text-[9px] font-bold tracking-[0.3em] text-royal-blue/60 uppercase">
      {tag}
    </span>

    <Heading
      level="h3"
      title={title}
      description={desc}
      headerClassName="text-2xl font-medium tracking-tight text-slate-900 dark:text-white mb-3"
      descriptionClassName="text-sm font-light leading-relaxed text-slate-500 dark:text-slate-400"
      className="mb-0"
    />
  </div>
);
