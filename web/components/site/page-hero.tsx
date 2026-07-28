import { DitherField } from "@/components/shader/dither-field";

/**
 * The header every secondary public page opens with.
 *
 * Uses the sphere field rather than the landing page's warp, which keeps the hero distinct: the
 * home page is the only place the page itself appears to fold. Shorter than a full viewport too,
 * because someone landing on the FAQ came for an answer, not a view.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <section className="scanlines relative overflow-hidden border-b border-edge">
      {/* Oversized and centred so the sphere's own circular edge sits well outside the hero.
          A canvas that only just covers the box leaves that boundary visible, which reads as a
          rounded corner rather than as a field. */}
      <DitherField
        variant="blackhole"
        className="pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[200vmax] -translate-x-1/2 -translate-y-1/2"
        speed={0.7}
        scale={1.35}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-void/40" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(7,8,10,0.85) 0%, rgba(7,8,10,0.5) 50%, transparent 80%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void to-transparent"
      />

      <div className="relative mx-auto max-w-app px-5 pt-40 pb-20 sm:px-8 sm:pt-48 sm:pb-24">
        <span className="label">{eyebrow}</span>
        <h1 className="text-headline mt-6 max-w-4xl text-balance text-ink">{title}</h1>
        {lede && (
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-ink-dim text-pretty sm:text-xl">
            {lede}
          </p>
        )}
      </div>
    </section>
  );
}
