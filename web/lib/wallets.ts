/**
 * The wallets Stellar Wallets Kit can broker.
 *
 * These are Nebula's "auth providers". There is no email, password, or social login anywhere in
 * the product, because there is nothing to log in *to*: the vault is non-custodial and has no
 * accounts, no server, and no user records. Your wallet is your identity, and signing a
 * transaction is the only authentication that exists.
 *
 * The list will move as the kit adds and drops adapters, which is why it lives here rather than
 * hardcoded into the page.
 */
export interface Wallet {
  id: string;
  name: string;
  blurb: string;
  /** Where to get it, for people who have none installed. */
  url: string;
  platforms: string;
  recommended?: boolean;
}

export const WALLETS: Wallet[] = [
  {
    id: "freighter",
    name: "Freighter",
    blurb: "The most widely used Stellar extension. Maintained by SDF.",
    url: "https://freighter.app",
    platforms: "Browser extension",
    recommended: true,
  },
  {
    id: "lobstr",
    name: "Lobstr",
    blurb: "Popular mobile wallet. Connects by scanning a code.",
    url: "https://lobstr.co",
    platforms: "iOS, Android",
  },
  {
    id: "xbull",
    name: "xBull",
    blurb: "Extension and web wallet with hardware support.",
    url: "https://xbull.app",
    platforms: "Extension, web",
  },
  {
    id: "albedo",
    name: "Albedo",
    blurb: "Signs in a popup. Nothing to install.",
    url: "https://albedo.link",
    platforms: "Web",
  },
  {
    id: "rabet",
    name: "Rabet",
    blurb: "Lightweight extension wallet.",
    url: "https://rabet.io",
    platforms: "Browser extension",
  },
  {
    id: "hana",
    name: "Hana",
    blurb: "Multi-chain wallet with Stellar support.",
    url: "https://hanawallet.io",
    platforms: "Extension, mobile",
  },
];
