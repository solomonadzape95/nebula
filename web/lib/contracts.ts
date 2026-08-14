/**
 * Deployed addresses, mirrored from `deployments/testnet.json`.
 *
 * Hardcoded rather than imported so the client bundle does not carry the whole deployment file
 * including the salt and operator keys. When the app starts reading live chain state this becomes
 * a build-time import of just the public fields.
 */
export type StellarNetwork = "testnet" | "mainnet";

export const NETWORK: StellarNetwork = "testnet";

/**
 * The network passphrase every signature is bound to.
 *
 * Written out rather than imported from `Networks` in the SDK, because this module is pulled into
 * client components for `shortAddress` and the explorer links — and importing the SDK here would
 * drag it into every one of those bundles for two string constants. These values are part of the
 * protocol and have not changed since 2015.
 */
const PASSPHRASES: Record<StellarNetwork, string> = {
  mainnet: "Public Global Stellar Network ; September 2015",
  testnet: "Test SDF Network ; September 2015",
};

export const NETWORK_PASSPHRASE = PASSPHRASES[NETWORK];

export const VAULT_ID = "CDONRBWSSLXWLB7YN6SI4MDBIFTXBKBZTKOGRL537LP4RGAIXDLBHMQX";
export const SHARE_TOKEN_ID = "CAEEI27XLJHMJBI25PL36DJ7FEK6TMVCQ7TP2PRQ4EXFVOUK5NI464CT";
export const STRATEGY_ID = "CATKCADBXINDP45VLR27GZDNJSUPAZNNADCMT6XYBAH2AEN5DO2FI5DU";
export const BLEND_POOL_ID = "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF";
export const UNDERLYING_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export const explorerContract = (id: string) =>
  `https://stellar.expert/explorer/${NETWORK}/contract/${id}`;

export const explorerTx = (hash: string) =>
  `https://stellar.expert/explorer/${NETWORK}/tx/${hash}`;

export const explorerAccount = (address: string) =>
  `https://stellar.expert/explorer/${NETWORK}/account/${address}`;

/** `GABC…WXYZ`. Full Stellar addresses are 56 characters and unreadable in a table. */
export const shortAddress = (address: string, lead = 4, tail = 4) =>
  address.length <= lead + tail + 1 ? address : `${address.slice(0, lead)}…${address.slice(-tail)}`;
