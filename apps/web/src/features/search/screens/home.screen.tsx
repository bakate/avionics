import {
  SmartPhoneIcon,
  StarIcon,
  UmbrellaIcon,
} from "@hugeicons/core-free-icons";
import { type AirportCode } from "@workspace/domain/kernel";
import { Heading } from "@workspace/ui/components/heading";
import { Section } from "@workspace/ui/components/section";
import { useTranslation } from "react-i18next";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import { DestinationCard } from "../components/destination-card";
import { HeroStatBadge } from "../components/home/hero-stat-badge";
import { HomeFooter } from "../components/home/home-footer";
import {
  FilledStar,
  SocialProofAvatars,
} from "../components/home/social-proof-avatars";
import { TestimonialCard } from "../components/home/testimonial-card";
import { ValueCard } from "../components/home/value-card";
import { SearchHub } from "../components/search-hub";
import { type SearchFormValues } from "../components/types";

const HomePage = () => {
  const { t } = useTranslation();
  const { state, send, context, isLoading } = useBookingMachine();

  const handleSelectDestination = (code: string) => {
    send({
      type: "SET_SEARCH_PARAMS",
      params: { destination: code as AirportCode },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isFetchingBookings = isLoading && state === "fetchingBookings";
  const hasBookings = context.allBookings.length > 0;

  const valueItems = [
    {
      tag: t("home.values.reliability.tag"),
      icon: SmartPhoneIcon,
      title: t("home.values.reliability.title"),
      desc: t("home.values.reliability.desc"),
    },
    {
      tag: t("home.values.excellence.tag"),
      icon: StarIcon,
      title: t("home.values.excellence.title"),
      desc: t("home.values.excellence.desc"),
    },
    {
      tag: t("home.values.comfort.tag"),
      icon: UmbrellaIcon,
      title: t("home.values.comfort.title"),
      desc: t("home.values.comfort.desc"),
    },
  ] as const;

  const testimonials = [
    {
      quote: t("home.testimonials.sophie.quote"),
      author: t("home.testimonials.sophie.author"),
      role: t("home.testimonials.sophie.role"),
      avatarIndex: 21,
    },
    {
      quote: t("home.testimonials.thomas.quote"),
      author: t("home.testimonials.thomas.author"),
      role: t("home.testimonials.thomas.role"),
      avatarIndex: 33,
    },
    {
      quote: t("home.testimonials.amara.quote"),
      author: t("home.testimonials.amara.author"),
      role: t("home.testimonials.amara.role"),
      avatarIndex: 47,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-background font-sans relative overflow-x-hidden">
      {/* ─── Hero Section ────────────────────────────────────────── */}
      <div className="relative h-[80vh] min-h-[640px] w-full">
        {/* Background Visual */}
        {/* Background Visual (Lighter, unified) */}
        <div className="absolute inset-0 z-0 bg-slate-900">
          <img
            src="/images/hero_premium.png"
            alt={t("home.badge")}
            className="h-full w-full object-cover object-center motion-safe:scale-105 motion-safe:animate-slow-zoom"
          />
        </div>

        {/* Hero Content Area */}
        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-6 pb-32 pt-16 lg:px-8">
          {/* Focal Mask: Localized dark gradient behind the text for premium focus */}
          <div className="absolute -left-20 top-1/2 -translate-y-1/2 z-[-1] h-screen w-full max-w-3xl opacity-60 blur-[120px] bg-linear-to-r from-royal-blue/60 via-black/40 to-transparent pointer-events-none" />
          <div className="mb-6 flex motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-4 motion-safe:duration-1000">
            <span className="flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[9px] font-bold uppercase tracking-[0.3em] text-white backdrop-blur-md">
              <FilledStar size={10} />
              {t("home.premiumExperience")}
            </span>
          </div>

          <div className="max-w-4xl space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-8 motion-safe:duration-1000">
            <h1 className="font-heading text-6xl font-medium leading-[1.05] text-white text-shadow-premium md:text-8xl lg:text-9xl tracking-tight">
              {t("home.title")}
            </h1>
            <p className="max-w-xl text-lg font-light leading-relaxed text-slate-100/90 text-shadow-premium md:text-xl">
              {t("home.subtitle")}
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-1000">
            <SocialProofAvatars count={124500} />
            <div className="sm:flex sm:items-center divide-x divide-white/10 grid grid-cols-2 gap-3 ">
              <HeroStatBadge
                value="50+"
                label={t("home.hero.stats.destinations")}
                className="px-5 first:pl-0"
              />
              <HeroStatBadge
                value="2M+"
                label={t("home.hero.stats.travelers")}
                className="px-5"
              />
              <HeroStatBadge
                value="4.9★"
                label={t("home.hero.stats.rating")}
                className="px-5"
              />
              <HeroStatBadge
                value="24/7"
                label={t("home.hero.stats.support")}
                className="px-5 last:pr-0"
              />
            </div>
          </div>
        </div>

        {/* Transition Bridge */}
        <div className="absolute -bottom-48 left-1/2 -translate-x-1/2 z-20 h-96 w-full max-w-5xl opacity-20 blur-[120px] bg-royal-blue/30 pointer-events-none" />

        {/* Global Search Hub Overlay */}
        <div className="absolute bottom-0 left-0 z-30 w-full translate-y-[80%] sm:translate-y-[50%]">
          <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
            <SearchHub
              onSearch={(params: SearchFormValues) =>
                send({ type: "SEARCH", params })
              }
              isLoading={isLoading && state === "searching"}
              defaultValues={context.searchParams ?? undefined}
              allBookings={context.allBookings}
              isFetchingBookings={isFetchingBookings}
              hasBookings={hasBookings}
              onRetryFetchBookings={() => send({ type: "FETCH_BOOKINGS" })}
              error={
                state === "error" ? (context.error ?? undefined) : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* ─── Destinations Showcase ─────────────────────────────────── */}
      <div className="relative z-10 bg-linear-to-b from-slate-50 via-white to-white dark:from-slate-950/20 dark:via-background dark:to-background pt-32 md:pt-48">
        <Section spacing="xl">
          <div className=" flex flex-col items-center text-center gap-8 mt-38 sm:mt-0">
            <div className="mb-4 h-px w-20 bg-linear-to-r from-transparent via-royal-blue to-transparent" />
            <Heading
              level="h2"
              title={t("home.destinations.title")}
              description={t("home.destinations.subtitle")}
              headerClassName="font-heading text-4xl md:text-5xl lg:text-6xl"
              descriptionClassName="text-base md:text-lg mt-3 max-w-2xl mx-auto text-slate-500"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <DestinationCard
              city="Paris"
              country="France"
              price="€840"
              code="CDG"
              image="/images/paris.png"
              promo={t("home.destinations.promoText")}
              onSelect={handleSelectDestination}
            />
            <DestinationCard
              city="Tokyo"
              country="Japan"
              price="€1,240"
              code="HND"
              image="/images/tokyo.png"
              onSelect={handleSelectDestination}
            />
            <DestinationCard
              city="Dakar"
              country="Sénégal"
              price="€620"
              code="DSS"
              image="/images/dakar.png"
              promo={t("home.destinations.promoText")}
              onSelect={handleSelectDestination}
            />
            <DestinationCard
              city="New York"
              country="USA"
              price="€950"
              code="JFK"
              image="/images/newyork.png"
              onSelect={handleSelectDestination}
            />
          </div>
        </Section>
      </div>

      {/* ─── Brand Values ──────────────────────────────────────────── */}
      <Section spacing="lg">
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="mb-4 h-px w-20 bg-linear-to-r from-transparent via-royal-blue to-transparent" />
          <Heading
            level="h2"
            title={t("home.values.title")}
            description={t("home.values.subtitle")}
            headerClassName="text-3xl md:text-5xl"
          />
        </div>

        <div className="grid grid-cols-1 gap-y-12 md:grid-cols-3 md:grid-rows-[auto_auto_auto_auto] gap-x-8">
          {valueItems.map((item) => (
            <ValueCard key={item.tag} {...item} />
          ))}
        </div>
      </Section>

      {/* ─── Social Proof Section ──────────────────────────────────── */}
      <Section
        spacing="lg"
        className="bg-slate-50/80 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-900"
      >
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="mb-4 h-px w-20 bg-linear-to-r from-transparent via-royal-blue to-transparent" />
          <Heading
            level="h2"
            title={t("home.testimonials.title")}
            description={t("home.testimonials.subtitle")}
            headerClassName="text-3xl md:text-5xl"
          />
        </div>

        <div className="grid grid-cols-1 gap-y-12 md:grid-cols-3 md:grid-rows-[auto_1fr_auto] gap-x-8">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.author} {...testimonial} />
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-2">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((index) => (
              <FilledStar key={index} size={20} />
            ))}
          </div>
          <p className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white">
            {t("home.testimonials.rating")}
          </p>
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">
            {t("home.testimonials.reviewsCount")}
          </p>
        </div>
      </Section>

      {/* ─── Visual Footer ────────────────────────────────────────── */}
      <HomeFooter />
    </div>
  );
};

export default HomePage;
