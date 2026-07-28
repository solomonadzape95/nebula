import { NETWORK } from "@/lib/contracts";

/** Resolves once, so the kit is configured exactly one time per page load. */
let kitPromise: Promise<typeof import("@creit.tech/stellar-wallets-kit").StellarWalletsKit> | null =
  null;

/**
 * Loads and configures Stellar Wallets Kit.
 *
 * Shared by the connection provider and the transaction layer so signing can never run against an
 * uninitialised kit. The kit is a static singleton, but `init` replaces its module list and network
 * wholesale, so it must be called exactly once and before anything else touches it.
 *
 * Adapters are imported from their individual subpaths rather than through a catch-all. The kit
 * ships sixteen of them, most of which Nebula does not offer, and pulling them all in would mean
 * shipping hardware-wallet and WalletConnect transports to every visitor. The whole module is
 * imported lazily for the same reason: nobody reading the FAQ should download it.
 */
export function loadKit() {
  kitPromise ??= (async () => {
    const [{ StellarWalletsKit }, { Networks }, freighter, lobstr, xbull, albedo, rabet, hana] =
      await Promise.all([
        import("@creit.tech/stellar-wallets-kit"),
        import("@creit.tech/stellar-wallets-kit/types"),
        import("@creit.tech/stellar-wallets-kit/modules/freighter"),
        import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
        import("@creit.tech/stellar-wallets-kit/modules/xbull"),
        import("@creit.tech/stellar-wallets-kit/modules/albedo"),
        import("@creit.tech/stellar-wallets-kit/modules/rabet"),
        import("@creit.tech/stellar-wallets-kit/modules/hana"),
      ]);

    StellarWalletsKit.init({
      modules: [
        new freighter.FreighterModule(),
        new lobstr.LobstrModule(),
        new xbull.xBullModule(),
        new albedo.AlbedoModule(),
        new rabet.RabetModule(),
        new hana.HanaModule(),
      ],
      network: NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
    });

    return StellarWalletsKit;
  })();

  return kitPromise;
}
