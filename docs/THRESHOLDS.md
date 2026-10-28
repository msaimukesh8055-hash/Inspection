# Routing thresholds: why 75% and ₹1,500

The Router (`supabase/functions/_shared/router.ts`) sends a return to **Path A** (billed at the counter) only when:

- the total is **₹1,500 or less**, and
- every damage item has AI confidence of **at least 75%**.

Anything else goes to **Path B** (the inspector). Both values are rows in the `config` table (`threshold_inr = 1500`, `min_confidence = 0.75`), with the same defaults in `_shared/constants.ts`. Changing them is a settings change, not a code change.

> **In this demo, 75% and ₹1,500 are starting assumptions.** The tables below show how they would be set for real, from 2–4 weeks of running the AI and an inspector side by side on the same returns. **The numbers are illustrative, not measured.**

## The trade-off

- **More returns on Path A** saves inspector time and finishes the return at the counter.
- **More accuracy on Path A** means no rider is billed wrongly.

Each setting is the point that automates the most returns while accuracy stays high.

## 1. Confidence bar: why 75%

If any damage item is below the bar, the return goes to Path B.

| Confidence bar | Returns billed at the counter (Path A) | Accuracy of those bills | Verdict |
|---|---|---|---|
| 60% | 90% | 88% | Too many wrong bills |
| **75%** | **75%** | **96%** | **Best balance** |
| 85% | 55% | 98% | Inspector overloaded |
| 95% | 25% | 99% | Almost everything goes to the inspector |

A higher bar is more accurate, but it sends more returns to the inspector. **75% is the lowest bar where accuracy stays above 95%**, so the most returns are automated without wrong bills.

## 2. Money limit: why ₹1,500

AI result compared with the inspector's, grouped by bill amount:

| Bill amount | Typical damage | Share of returns | AI accuracy vs inspector |
|---|---|---|---|
| ₹0 | No new damage | 50% | 98% |
| ₹1–500 | Light scratch, polish | 25% | 97% |
| ₹500–1,000 | Several scratches, small part | 10% | 95% |
| ₹1,000–1,500 | Mirror, lamp, deeper scratch | 7% | 93% |
| **₹1,500–2,000** | **Dented or replaced panel** | **5%** | **76%** ← accuracy drops |
| ₹2,000+ | Cracks, several panels | 3% | 62% |

Up to ₹1,500 the AI agrees with the inspector more than 90% of the time. Above ₹1,500 it falls to about 76%, because dents and replacements are harder to judge from photos. **₹1,500 is that cliff**: above it, a human decides. It still covers about 92% of returns, so most finish at the counter.

## How they would be set and changed in production

1. **Shadow period:** for 2–4 weeks, the AI assesses every return and an inspector checks it too.
2. **Build both tables** from those results.
3. **Start strict** (for example ₹500 and 85%), then relax step by step as overrides and disputes stay low.
4. **Every change** must pass the golden eval set (`evals/`) before it goes live.
5. **If staff report too many errors,** make Path A stricter for a while: **raise** the confidence bar and **lower** the money limit. More returns then go to the inspector.

## Not to confuse

The dashboard's "75% billed at the counter" is a coincidence in the sample history: 18 of 24 returns went to Path A. It is not the confidence bar.
