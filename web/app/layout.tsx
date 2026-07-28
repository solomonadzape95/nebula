import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { WalletProvider } from "@/components/wallet/wallet-provider";
import "./globals.css";

/**
 * Satoshi, self-hosted.
 *
 * Fontshare serves it under the ITF Free Font License, but loading it from their CDN would mean a
 * render-blocking request to a third party on every visit. The four weights are 24KB each and are
 * inlined into the build instead.
 */
const satoshi = localFont({
  variable: "--font-satoshi",
  display: "swap",
  src: [
    { path: "./fonts/Satoshi-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Satoshi-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Satoshi-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Satoshi-900.woff2", weight: "900", style: "normal" },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Geist Pixel, for figures big enough to deserve it.
 *
 * A bitmap face is the right typographic answer to a design that is already a halftone print: the
 * Circle variant draws its pixels as round dots, the same shape as the lattice in the logo and the
 * dither field behind the hero. The number stops being text sitting on the texture and becomes part
 * of it.
 *
 * Self-hosted because it is not on Google Fonts — Vercel ship it under the SIL Open Font License
 * from their own repository, so `next/font/google` cannot reach it and `localFont` is the only
 * route. One 27KB file, in line with the Satoshi weights above.
 *
 * It is deliberately *not* the default for every number. Rendered at 12–14px, where most figures in
 * a table live, the gaps between the round pixels eat the stroke and the text goes faint and hard
 * to read; by 20px it is crisp. So this is bound to a `.figure` class used on display figures only,
 * and Geist Mono keeps the small ones.
 */
const geistPixel = localFont({
  variable: "--font-pixel-face",
  display: "swap",
  src: [{ path: "./fonts/GeistPixel-Circle.woff2", weight: "400", style: "normal" }],
});

export const metadata: Metadata = {
  title: "Nebula · Liquid yield for XLM",
  description:
    "Deposit XLM, receive nXLM. It is worth more XLM every day, and stays tradeable and spendable the whole time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      /* `dark` is fixed, not toggled: shadcn and dither-kit both branch on it, and Nebula has no
         light theme — the whole design is a dithered print on black. */
      className={`dark ${satoshi.variable} ${geistMono.variable} ${geistPixel.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
