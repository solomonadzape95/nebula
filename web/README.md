# Nebula — web

The interface. Next.js 16 App Router, deployed to Vercel.

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Where the numbers come from

Two sources, on purpose, and the page says which is which when it matters.

**Live vault figures** — share price, TVL, available liquidity — are read from the contracts on
every request. Soroban has no read endpoint, so a "read" is a transaction simulated and thrown away;
`lib/stellar.ts` does that and returns `null` rather than throwing, so an unreachable RPC produces a
banner explaining itself instead of a broken page.

**History** — the price series, activity, the depositor register — comes from the indexer's Postgres
via `lib/indexer.ts`. Profiles and reviews live in the same database.

The two fail independently. If the database is down the live figures still render; if RPC is down
the charts still do. Neither silently shows a stale number as a current one.

## Auth

There are no accounts. A wallet is the identity, and a signed transaction is the only
authentication that exists for anything on chain.

Two things need more than that, because they are rows in a database keyed by address — and an
address is a public identifier anyone can read off the activity feed:

- **Usernames and reviews** require proving control of the wallet. `lib/session-actions.ts` issues a
  challenge transaction built with sequence 0, which no validator will ever accept, and verifies the
  signature server-side against the address's own key. It signs a transaction rather than a message
  because `signTransaction` is the operation every wallet implements — including Albedo, which has
  no `signMessage` at all — and because Stellar message signing (SEP-53) hashes a prefixed form of
  the text, so verifying the message itself never matches.
- **The admin section** lives behind `ADMIN_PREFIX`, an address allowlist, and a password compared
  server-side. The resulting cookie is HMAC-signed with its expiry inside the signed payload.
  `proxy.ts` rewrites unauthenticated requests away *before* the page renders, because a layout that
  returns a gate instead of `children` still runs the page underneath and serializes its data into
  the RSC payload.

## Design

The whole site is a halftone print on near-black. Nothing is a picture of that effect: the lattices
are real CSS masks and the shader fields are [Paper Shaders](https://paper-design.github.io/shaders)
running procedurally.

Three typefaces, three jobs, no overlap:

| Face | Used for |
|---|---|
| Satoshi | Prose |
| Geist Mono | Addresses, hashes, labels, small table figures |
| Geist Pixel (Circle) | Display figures, via the `.figure` utility |

Geist Pixel is applied only at 20px and above. Its pixels are round dots — the same mark the dither
lattice is made of — but at the 12–14px a table cell lives at, the gaps between them eat the stroke
and the number goes faint.

## Environment

See `.env.example` for the full list. The two that are easy to get wrong:

- `DATABASE_URL` — on Vercel, use the **transaction pooler** URI. Serverless functions open a
  connection per invocation and exhaust a direct pool quickly.
- `POSTHOG_API_KEY` — a *personal* key that reads the whole project, unlike the public
  `NEXT_PUBLIC_POSTHOG_KEY` that ships to the browser. `lib/posthog-query.ts` imports `server-only`
  so a client component importing it fails the build rather than bundling the credential.

Analytics captures the deposit funnel and no wallet addresses: the privacy page promises analytics
is not connected to your address, and that promise came first. Amounts are recorded as size bands,
since an exact figure plus a timestamp identifies one transaction on a public ledger.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```
