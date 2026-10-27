# Eval results

A readable version of the latest eval runs. The raw data is in `evals/results/<label>.json` (the runner saves each case there so a run cut short by the free daily limit can resume). How the evals work: [`.claude/skills/run-evals/SKILL.md`](../.claude/skills/run-evals/SKILL.md).

**Safety gate:** routing right on at least 90% of cases, and no damaged scooter that should go to the Inspector billed at the counter.

## Run 1: all 15 cases · label `gemini-3.5-flash` · 26 Oct 2026

Damage agent on Gemini 3.5 Flash; Estimate, Bill and Order agents on Gemini Flash-Lite. Includes the scratch-must-be-polish rule check.

| Case | Scenario | Correct answer | AI's answer | Result |
|---|---|---|---|---|
| E01 | No new damage (GA07M2211) | ₹0, Path A | ₹0, Path A | ✅ |
| E02 | No new damage (GA07M2212) | ₹0, Path A | ₹0, Path A | ✅ |
| E03 | No new damage (GA07M2213) | ₹0, Path A | ₹0, Path A | ✅ |
| E04 | Scratch, left side panel | ₹500, Path A | ₹0, Path A | ❌ scratch missed |
| E05 | Scratch, right side panel | ₹500, Path A | ₹0, Path A | ❌ scratch missed |
| E06 | Scratch, front mudguard | ₹500, Path A | ₹0, Path A | ❌ scratch missed |
| E07 | Scratch, right side panel (GA07M2213) | ₹500, Path A | ₹500, Path A | ✅ |
| E08 | Dent, left side panel | Path B | ₹1,850, Path B (over ₹1,500) | ✅ |
| E09 | Dent, right side panel | Path B | ₹1,850, Path B (over ₹1,500) | ✅ |
| E10 | Cracked tail lamp | Path B | ₹1,150, Path B (crack) | ✅ |
| E11 | Dent and scratch | Path B | ₹2,350, Path B (over ₹1,500) | ✅ |
| E12 | Blurry side photos | Path B | Path B (poor photos) | ✅ |
| E13 | Dark photo, wrong angle | Path B | Path B (poor photos) | ✅ |
| E14 | Scratch already there at pickup | ₹0, Path A | ₹0, Path A (ignored) | ✅ |
| E15 | Dent already there at pickup | ₹0, Path A | ₹0, Path A (ignored) | ✅ |

| Scorecard | Result |
|---|---|
| Routing right | **15 / 15 (100%)**: safety gate passed |
| Damaged scooter billed at the counter by mistake | **0** |
| False alarms on clean scooters | **0** |
| Damage found | **67%**: three small scratches missed, so the rider would be undercharged |
| Time per return | about 37 seconds |
| Cost | ₹0 (free tier) |

**What it showed:** every return went down the right path, but the Damage agent missed small scratches (E04, E05, E06).

## Run 2: the scratch cases after a prompt fix · label `scratch-prompt-v2` · 26 Oct 2026

**Change:** the Damage prompt got a checklist of spots to check on each side (mudguard, lamps, mirrors, side panels), and an instruction to report a doubtful mark with low confidence so a person checks it. The line "most returns have no new damage" was removed, because it nudged the AI to call doubtful returns clean.

Re-ran the 3 missed scratches plus the 5 cases most likely to show false alarms:

| Case | Scenario | Run 1 | Run 2 | Result |
|---|---|---|---|---|
| E01–E03 | No new damage | ₹0 | ₹0 | ✅ still no false alarms |
| E04 | Scratch, left side panel | ₹0 (missed) | ₹500, Path A | ✅ fixed |
| E05 | Scratch, right side panel | ₹0 (missed) | ₹500, Path A | ✅ fixed |
| E06 | Scratch, front mudguard | ₹0 (missed) | ₹0 (missed) | ❌ still missed |
| E14–E15 | Damage already there at pickup | ₹0 | ₹0 | ✅ still ignored |

**What it showed:** the prompt fix recovered 2 of the 3 missed scratches with no new false alarms. E06 is kept as a known hard case: the scooter fills only about a third of that front photo, so the real fix is closer, guided photos at the counter, not more prompt tuning.

## What's next
- A full 15-case run on the latest prompt (the prompt change affects every case).
- Once live: every month, a sample of real returns checked fully by hand and compared with the AI. Every mismatch becomes a new test case.
