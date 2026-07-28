/**
 * One source for the FAQ, shared by the landing section and the dedicated page.
 *
 * Answers are written to be true rather than reassuring. A yield product that dodges "can I lose
 * money" is a yield product nobody should use, and a reviewer who catches one evasive answer stops
 * believing the rest of the page.
 */
export interface FaqItem {
  q: string;
  a: string;
  /** Shown on the landing section, which only carries the essentials. */
  featured?: boolean;
}

export const FAQ: FaqItem[] = [
  {
    q: "What exactly is nXLM?",
    a: "A receipt for the XLM you deposited. The quantity you hold never changes; what changes is how much XLM one nXLM is worth. It behaves like an ordinary Stellar token, so you can hold it, trade it on SDEX, send it, or use it elsewhere while it keeps earning.",
    featured: true,
  },
  {
    q: "Where does the yield actually come from?",
    a: "Borrower interest. Nebula supplies your XLM to Blend, a lending market on Stellar, where people borrow against collateral and pay interest to do it. That interest is the entire source. There are no token emissions, no inflation, and nothing subsidising the return.",
    featured: true,
  },
  {
    q: "Is this staking?",
    a: "No, and nothing on Stellar is. The Stellar Consensus Protocol is federated Byzantine agreement, not proof-of-stake: validators bond nothing, earn no block rewards, and cannot be slashed. Inflation was switched off in Protocol 12 back in 2019. Anyone offering you XLM staking rewards is describing a mechanism that does not exist.",
    featured: true,
  },
  {
    q: "Can I lose money?",
    a: "Yes. Three ways. A bug in Nebula's contracts, a failure in Blend, or a period where borrower interest does not cover the protocol fee. The contracts are open source and covered by 57 tests including the known attack classes, deposits are capped during beta, and every strategy has its own ceiling so one venue cannot take the whole vault. None of that is the same as safe.",
    featured: true,
  },
  {
    q: "What are the fees?",
    a: "Ten percent of the yield, never of your deposit. If the vault earns nothing, it charges nothing. There is no deposit fee, no withdrawal fee, and no management fee on your principal.",
    featured: true,
  },
  {
    q: "How quickly can I withdraw?",
    a: "Usually immediately. Roughly ten percent of the vault is held back as an idle reserve precisely so ordinary withdrawals are instant. If you redeem more than the reserve holds, the vault pulls the difference back out of Blend in the same transaction, which works as long as the lending pool has cash available.",
    featured: true,
  },
  {
    q: "What happens if Blend is fully borrowed out?",
    a: "A lending pool with no idle cash cannot be exited, so a large redemption can fail until borrowers repay or new deposits arrive. Nebula reports the amount that is genuinely redeemable right now rather than the amount you nominally own, so you find out before you sign rather than after.",
  },
  {
    q: "Can the team touch my funds?",
    a: "No. The admin can register strategies and adjust parameters like the fee and the reserve target. It cannot mint nXLM, move user funds, or block redemptions. The keeper, which runs the automated allocate and harvest jobs, can only move money between the vault and already-registered strategies.",
  },
  {
    q: "Can withdrawals ever be paused?",
    a: "Deposits can. Withdrawals cannot, by construction. A vault that can trap your funds is a custodian, and Nebula is not one.",
  },
  {
    q: "Why does my nXLM balance never go up?",
    a: "Because the price does instead. A token whose balance grows on its own breaks most things it touches: exchanges, lending markets, and accounting all assume a balance only changes when someone moves it. Keeping the quantity fixed is what lets nXLM be used anywhere else on Stellar.",
  },
  {
    q: "Is this on mainnet?",
    a: "No. Nebula is on Stellar testnet, where the tokens are free and have no value. Nothing here is real money, and it should be treated as software to try rather than a place to put savings.",
  },
  {
    q: "Do I need to claim anything?",
    a: "Never. There are no reward claims, no compounding button, and no positions to manage. A keeper harvests interest on a schedule and it lands in the share price automatically, whether or not you are paying attention.",
  },
];

export const FEATURED_FAQ = FAQ.filter((item) => item.featured);
