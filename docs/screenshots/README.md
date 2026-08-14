# Screenshots

Drop the images in **this directory**, using exactly these filenames. The README's Screenshots
section already links to them, so a correctly-named file appears the moment it lands and nothing
else needs editing.

| Filename | What it shows | Checklist item |
|---|---|---|
| `dashboard.png` | `/app` on desktop, connected, with a position — balance, nXLM, share price, TVL | 6 — product UI |
| `deposit.png` | The deposit card mid-flow: amount entered, estimated nXLM shown, button armed | 6 — product UI |
| `chart.png` | The share-price chart on `/stats`, with the line visibly above where it started | 6 — product UI |
| `mobile.png` | 375px wide. Dashboard and deposit flow side by side in one image | 7 — mobile responsive |
| `analytics.png` | PostHog: the funnel with drop-off percentages, or the `$exception` issue list | 8 — analytics/monitoring |
| `admin-feedback.png` | `/asdfg/admin/feedback` — survey responses with the corroborated count | 8 and 11 |
| `admin-users.png` | `/asdfg/admin/users` — the depositor list with tx hashes and explorer links | 10 — wallet interactions |
| `contract.png` | The vault on Stellar Expert, showing it deployed and invoked | 5 — contract address |

## How to take them

- **PNG, 2× device pixel ratio.** A blurry screenshot of sharp work reads as sloppy work.
- **Crop tight.** No browser chrome, no bookmarks bar, no desktop behind it — unless the URL bar is
  the point, which it is for `contract.png`.
- **Use the dark theme**, since that is what the product actually looks like.
- **Populate first.** A dashboard of zeros is worse than no dashboard: it shows the layout and
  proves the thing is empty in the same image. Run `./scripts/smoke-test.sh` with `SKIP_REDEEM=1`
  first so there is an open position and a moved share price to photograph.
- **Mask nothing that is already public.** Testnet addresses are on a public ledger; blurring them
  looks like something is being hidden and gains nothing.

## The one that is not ready yet

`analytics.png` needs real traffic. A funnel screenshot taken now is a row of zeros with drop-off
percentages of `0%`, which argues against the submission rather than for it. Take it after
recruiting, not before — it is the last screenshot, not the first.
