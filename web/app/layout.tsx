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
      className={`dark ${satoshi.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
