/**
 * Deployed addresses, mirrored from `deployments/testnet.json`.
 *
 * Hardcoded rather than imported so the client bundle does not carry the whole deployment file
 * including the salt and operator keys. When the app starts reading live chain state this becomes
 * a build-time import of just the public fields.
 */
export type StellarNetwork = "testnet" | "mainnet";

export const NETWORK: StellarNetwork = "testnet";

export const VAULT_ID = "CDGRL2EMFMLOCD6NRUKCL6CPNAF4SWK4DLQIM2AGFIN5P5CK3VXTUPHO";
export const SHARE_TOKEN_ID = "CAVRFADYBNPLRL734VGRS6FW4LXRDEKRZZDQCSMB7VXCFZPDZ5JB3SN2";
export const STRATEGY_ID = "CDSQOX3GQSE4HEM5IWKEMIZ56JHMTPFN3ZUN5PI4TH5WVFYGL5DAYQAR";
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
