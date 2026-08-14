"use client";

import dynamic from "next/dynamic";

import { useStillField } from "./use-still-field";

/**
 * A real photograph, dithered on the GPU.
 *
 * Where `DitherField` generates its own imagery, this takes a source image and reduces it to the
 * same two-colour halftone the rest of the design is built from. That is what lets a photo sit in
 * this layout without looking pasted in — it ends up made of the same dots as everything else.
 *
 * Images are NASA/JPL public domain. Real telescope imagery beats a film still here on every axis
 * that matters: it is free to use, it is genuinely astronomical rather than a render of one, and
 * "Nebula" running on actual NASA nebula photography is a better story than borrowed sci-fi.
 */
const ImageDithering = dynamic(
  () => import("@paper-design/shaders-react").then((mod) => mod.ImageDithering),
  { ssr: false },
);

export type ImageFieldSource = "footer" | "blackhole" | "nebula";

const SOURCES: Record<ImageFieldSource, { src: string; alt: string }> = {
  footer: {
    src: "/img/footer.jpg",
    alt: "A deep field of stars",
  },
  blackhole: {
    src: "/img/blackhole.jpg",
    alt: "A black hole with a relativistic jet. NASA/JPL-Caltech.",
  },
  nebula: {
    src: "/img/nebula.jpg",
    alt: "The Crab Nebula. NASA/ESA Hubble Space Telescope.",
  },
};

interface ImageFieldProps {
  source: ImageFieldSource;
  className?: string;
  /** Dither grid coarseness. Larger = chunkier dots. */
  pxSize?: number;
  /** How many tones survive the reduction. 2 is a hard duotone; 4 keeps some depth. */
  colorSteps?: number;
  colorBack?: string;
  colorFront?: string;
  colorHighlight?: string;
  fit?: "contain" | "cover";
}

export function ImageField({
  source,
  className,
  pxSize = 2.4,
  colorSteps = 3,
  colorBack = "#07080a",
  colorFront = "#3d8f6d",
  colorHighlight = "#86f2c0",
  fit = "cover",
}: ImageFieldProps) {
  const { src, alt } = SOURCES[source];
  const still = useStillField();

  return (
    <div className={className} role="img" aria-label={alt}>
      <ImageDithering
        className="absolute inset-0 h-full w-full"
        image={src}
        /* The output is a still either way — this is a photograph, not a generated field — so
           pinning the speed to zero costs nothing and guarantees no animation frame is ever
           scheduled for it. The pixel cap is the part that matters on a phone: the source images
           are full-resolution NASA plates, and dithering one across a DPR-3 viewport is a large
           amount of fill for something the halftone grid immediately coarsens. */
        speed={0}
        maxPixelCount={still ? 1280 * 720 : undefined}
        colorBack={colorBack}
        colorFront={colorFront}
        colorHighlight={colorHighlight}
        colorSteps={colorSteps}
        pxSize={pxSize}
        type="8x8"
        fit={fit}
      />
    </div>
  );
}
