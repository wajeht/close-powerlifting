import type { FC } from "hono/jsx";

interface PageHeroProps {
  title: string;
  subtitle?: string;
}

export const PageHero: FC<PageHeroProps> = ({ title, subtitle }) => (
  <section class="relative -mt-16 mb-16 ml-[calc(50%-50vw)] w-screen overflow-hidden bg-red-800">
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,255,255,0.12),transparent_70%)]"
      aria-hidden="true"
    />
    <div class="relative mx-auto max-w-5xl px-6 py-16 text-center sm:py-20">
      <h1 class="fade-in-heading font-display text-4xl leading-[1] tracking-tight text-white sm:text-5xl">
        {title}
      </h1>
      {subtitle && <p class="fade-in animation-delay-2 mt-4 text-white/70">{subtitle}</p>}
    </div>
  </section>
);
