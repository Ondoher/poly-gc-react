# Mahjong Solitaire Strategy Advice As A Proxy For Human Difficulty

## Scope

This note summarizes public Mahjong Solitaire strategy and pitfall advice from
online guides, then uses that advice as a rough proxy for what human players
find difficult.

The goal is not to prove human difficulty scientifically. The goal is to gather
external evidence about:

- which board situations repeatedly attract advice
- which mistakes repeatedly produce losses or frustration
- which of those situations are already tracked by this engine
- how well the current generation heuristics appear to target them

This is meant as supporting research for future difficulty tuning and future
player-grounded validation.

## Method

I reviewed public strategy and beginner-pitfall pages for Mahjong Solitaire,
clustered repeated advice into common themes, then counted how many distinct
references supported each theme.

Important limitations:

- these sources are not controlled human-subject studies
- many are consumer strategy guides rather than formal analyses
- counts below are counts of distinct references, not weighted quality scores
- repeated advice is only a proxy for perceived human difficulty, not proof
- the current engine and analyzer mostly target objective structural pressure,
  not every softer visual or perceptual cue reflected in player advice

Still, if many independent guides keep warning players about the same mistake,
that is useful evidence that the underlying board characteristic matters in
practice.

## Source Labels

Use these reference labels in the findings below:

- [[1]](#ref-1) FRVR strategy guide
- [[2]](#ref-2) Vita Mahjong beginner guide
- [[3]](#ref-3) Mahjong Online 365 tips
- [[4]](#ref-4) MPL Mahjong Solitaire strategy page
- [[5]](#ref-5) MahjongFun strategy page
- [[6]](#ref-6) FreeGameHub guide
- [[7]](#ref-7) TheMahjong.io mistakes article
- [[8]](#ref-8) Mahjong Boss beginner guide
- [[9]](#ref-9) Mahjong Pro strategy guide

## Ranked Findings By Reference Count

### 1. Prioritize moves that unblock or reveal the most tiles

- Reference count: `9/9`
- Sources: all reviewed references

Summary:

- The dominant public advice is to prefer moves that reveal new layers, free
  blocked tiles, open stacks, or increase future move count.
- Many guides frame this as the main difference between strong play and random
  clicking.

Why this likely matters to humans:

- Players experience boards as harder when a move produces little visible
  progress.
- A move that opens many tiles creates relief, optionality, and a sense of
  control.
- A move that opens nothing feels like wasted tempo and increases fear of
  hidden traps.

Inferred board characteristics:

- low unlock count after removal
- high blocker density
- buried central mass
- low frontier growth
- many legal moves that differ sharply in what they reveal

Match to current engine heuristics:

- `freedCount` and `freedRank`
- `getOpenPressure()`
- weighted tile picker and difficulty window
- pair-choice sensitivity analysis in the analyzer

Effectiveness rating: `High`

Why:

- This is the engine's clearest and strongest alignment with public strategy
  advice.
- Easy modes explicitly favor moves that open more tiles.
- Hard modes explicitly favor moves that open fewer tiles and preserve tension.

### 2. Work from the top, edges, tall stacks, and choke points first

- Reference count: `8/9`
- Sources: [[1]](#ref-1) [[2]](#ref-2) [[3]](#ref-3) [[4]](#ref-4) [[6]](#ref-6) [[7]](#ref-7) [[8]](#ref-8) [[9]](#ref-9)

Summary:

- Guides repeatedly recommend clearing top layers, exposed edges, long rows,
  high stacks, and obvious choke points early.
- Many treat these areas as the structural pressure points of a layout.

Why this likely matters to humans:

- Tall stacks and long rows are visually salient and easy to understand as
  blocked structure.
- Players feel pressure when important buried tiles sit under central or tall
  formations.
- Choke points are memorable because one tile visibly appears to lock several
  others.

Inferred board characteristics:

- high stack height
- long lateral runs
- central congestion
- single tiles capping multiple future tiles
- delayed access to interior layers

Match to current engine heuristics:

- `zWeight` in `scoreOpenTiles()`
- horizontal and vertical reference intersections
- stack-balance safety and balance pressure
- suspension safety thresholds based on effective open tiles

Effectiveness rating: `Medium-High`

Why:

- The engine strongly models stack height and some structural entanglement.
- It does not explicitly model human-visible "choke points" as a first-class
  concept, but several current signals approximate them.

### 3. Think ahead; do not take the first available match

- Reference count: `8/9`
- Sources: [[1]](#ref-1) [[2]](#ref-2) [[3]](#ref-3) [[4]](#ref-4) [[5]](#ref-5) [[6]](#ref-6) [[8]](#ref-8) [[9]](#ref-9)

Summary:

- Many guides say the core mistake is impulsive matching.
- The common corrective advice is to compare alternatives and forecast what each
  move changes.

Why this likely matters to humans:

- When a board offers several plausible matches, difficulty comes from deciding
  which one matters, not from simply spotting a legal move.
- A player's feeling of difficulty rises when several moves look acceptable but
  only some preserve future options.

Inferred board characteristics:

- high immediate ambiguity
- meaningful branch divergence
- hidden future consequences
- low recoverability after a plausible wrong choice

Match to current engine heuristics:

- analyzer pair-choice sensitivity
- downstream initial pair-choice playouts
- suspension as delayed consequence
- short-horizon probe
- difficulty windowing over weighted candidates

Effectiveness rating: `High`

Why:

- This is one of the main explicit design goals of the engine.
- The analyzer is already built to measure this exact story.

### 4. Be careful with duplicate-choice situations; preserve options among four-of-a-kind tiles

- Reference count: `7/9`
- Sources: [[1]](#ref-1) [[2]](#ref-2) [[3]](#ref-3) [[4]](#ref-4) [[5]](#ref-5) [[8]](#ref-8) [[9]](#ref-9)

Summary:

- Guides repeatedly warn that when two or more copies of the same tile are
  open, the wrong pairing can trap the remaining copies.
- A common refinement is that if all four copies are simultaneously removable,
  that choice is safe.

Why this likely matters to humans:

- This is one of the few clearly understandable forms of Mahjong Solitaire
  ambiguity.
- Players remember losing because they paired the "wrong two identical tiles."

Inferred board characteristics:

- multiple open copies of one face group
- asymmetric pair consequences
- buried remaining copies
- stacked duplicate tiles

Match to current engine heuristics:

- analyzer same-face pair-choice sensitivity
- face assignment spacing
- face avoidance
- suspension, which delays matching relationships and increases same-face
  consequence

Effectiveness rating: `Medium-High`

Why:

- The analyzer and face-assignment system clearly target this family of choice.
- The engine does not yet seem to have an explicit "safe four-of-a-kind" player
  model, but it does shape same-face ambiguity in several ways.

### 5. Use hint, undo, and shuffle strategically rather than reflexively

- Reference count: `6/9`
- Sources: [[1]](#ref-1) [[2]](#ref-2) [[4]](#ref-4) [[5]](#ref-5) [[6]](#ref-6) [[9]](#ref-9)

Summary:

- Public guides commonly say hints and undo are tools for recovery or learning,
  not substitutes for planning.
- Shuffle is typically treated as a last resort or variant-specific escape
  valve.

Why this likely matters to humans:

- Tool use is a direct expression of friction, uncertainty, and regret.
- Heavy undo or hint use is often a better signal of struggle than the final
  result alone.

Inferred board characteristics:

- local opacity
- branch regret
- delayed punishment after a move
- recoverable but confusing positions

Match to current engine heuristics:

- gameplay already supports undo and redo
- future validation notes now propose logging move order, undo, redo, hints,
  and repeated-board sessions
- analyzer can already compare branch consequence after deterministic replay

Effectiveness rating: `Medium`

Why:

- The engine supports the tools, and the notes now cover telemetry plans.
- But this is not currently a generation heuristic; it is mainly a future
  player-validation opportunity.

### 6. Watch for stacked identical tiles, trapped pairs, and critical blockers

- Reference count: `5/9`
- Sources: [[3]](#ref-3) [[4]](#ref-4) [[6]](#ref-6) [[7]](#ref-7) [[9]](#ref-9)

Summary:

- Several guides warn about identical tiles stacked on each other or bottleneck
  tiles whose removal order determines solvability.
- These are often described as dead-end creators or "critical" tiles.

Why this likely matters to humans:

- These patterns create memorable "I should have seen that earlier" moments.
- They also create fairness risk when the player cannot easily perceive the
  looming trap.

Inferred board characteristics:

- stacked same-face dependencies
- single critical blockers
- low-latency collapse after one wrong release order
- visually hidden trap structure

Match to current engine heuristics:

- stack-balance safety
- short-horizon probe
- suspension release timing
- face avoidance near future frontier tiles

Effectiveness rating: `Medium`

Why:

- The engine has several indirect protections against these situations.
- It does not yet appear to explicitly detect "stacked same-face critical
  blocker" patterns as a named heuristic.

### 7. Use flowers and seasons strategically, not immediately

- Reference count: `2/9`
- Sources: [[4]](#ref-4) [[7]](#ref-7)

Summary:

- A minority of guides treat flowers and seasons as flexible "wildcard-like"
  tools that should be saved for breaking choke points.

Why this likely matters to humans:

- Flexible matches feel powerful and memorable.
- Misusing them early can feel like wasting an escape resource.

Inferred board characteristics:

- flexible-match relief points
- late-game choke points
- local scarcity of alternative unlocks

Match to current engine heuristics:

- flowers and seasons are represented as special face groups in the tile set
- no obvious generation heuristic currently treats them as a strategic reserve

Effectiveness rating: `Low`

Why:

- The engine supports their matching semantics, but there does not appear to be
  a dedicated difficulty or generation policy that uses their flexibility as a
  human-facing control.

### 8. Keep the board balanced; do not tunnel on one side or tidy the board without gain

- Reference count: `3/9`
- Sources: [[1]](#ref-1) [[3]](#ref-3) [[6]](#ref-6)

Summary:

- Some guides explicitly warn against over-clearing one side or making visually
  neat but strategically empty matches.
- The common principle is balance and return on move investment.

Why this likely matters to humans:

- Human players often mistake local tidiness for strategic progress.
- Boards feel harsher when one region is overdeveloped while another remains
  locked and dangerous.

Inferred board characteristics:

- asymmetric frontier growth
- misleading low-value matches
- dominant local stacks or neglected regions

Match to current engine heuristics:

- stack-balance safety
- balance pressure
- open-pressure and freed-tile scoring

Effectiveness rating: `Medium`

Why:

- The engine explicitly tracks a structural notion of balance, though it is
  focused more on stack geometry than on broad human-perceived left/right
  balance.

## What This Suggests About Human Difficulty

The public advice landscape points to a few recurring human difficulty drivers:

1. `Low unlock value`
   - moves that reveal little progress feel dangerous and frustrating
2. `Ambiguous same-face choices`
   - players repeatedly fear pairing the wrong copies
3. `Tall or congested structure`
   - top layers, long rows, and choke points dominate human strategy advice
4. `Delayed punishment`
   - many guides explicitly warn that a move can look fine now and fail later
5. `Local opacity`
   - hints, undo, and restart advice suggest players often struggle to read
     future consequence directly

These are strong qualitative matches for the current analyzer story:

- pair-choice sensitivity
- downstream consequence
- open-pressure
- z and stack pressure
- dominant-stack risk

There is also an important boundary here:

- the current model is strongest where board difficulty can be described in
  objective structural terms
- the current model is weaker on softer perceptual factors such as visual
  salience, board readability, obviousness of choke points, and whether danger
  "looks dangerous" before the player understands the deeper structure

That means this note is useful in two directions:

- as support that the current structural heuristics are pointed at real human
  concerns
- as a source of future ideas for tuning less directly measurable
  human-perception factors

## Match Against Current Engine And Analyzer

### Strongest Matches

- `Unlock more tiles` advice matches `freedCount`, `freedRank`, and
  `openPressure` very well.
- `Think ahead` advice matches the analyzer's pair-choice metrics and the
  short-horizon probe.
- `Avoid wrong duplicate pairings` matches face-assignment spacing, face
  avoidance, and same-face branch analysis.

### Partial Matches

- `Top/edges/choke points first` is partially modeled through z weighting and
  structural intersection pressure, but not as a named "choke point" heuristic.
- `Board balance` is partially modeled through dominant-stack analysis and
  balance pressure, though the current signal is more geometric than
  player-psychological.

### Weak Matches Or Gaps

- `Use flowers/seasons as flexible relief tools` is not clearly represented as
  a generation-time control.
- `Undo and hint usage as evidence of human struggle` is a promising future
  signal but currently lives more in future notes than in shipping analysis.
- visually obvious pressure cues such as salience of choke points, readability
  of stacks, and perceptual clarity of dangerous structures are only indirectly
  represented today

## Effectiveness Summary

| Theme | Ref count | Engine/analyzer match | Effectiveness |
| --- | ---: | --- | --- |
| Unblock or reveal the most tiles | 9 | Freed-tile scoring, open pressure, difficulty window | High |
| Top, edges, stacks, choke points | 8 | Z weighting, intersections, stack pressure | Medium-High |
| Think ahead; do not click first match | 8 | Pair-choice analysis, suspension, short-horizon probe | High |
| Preserve options in duplicate-choice states | 7 | Same-face analysis, face spacing, face avoidance | Medium-High |
| Use hint/undo/shuffle strategically | 6 | Gameplay tools plus planned telemetry | Medium |
| Watch stacked identicals and critical blockers | 5 | Stack safety, short-horizon pressure, suspension safety | Medium |
| Keep board balanced; avoid low-value tidy moves | 3 | Balance pressure, dominant-stack risk, open pressure | Medium |
| Save flowers/seasons for key unlocks | 2 | Matching semantics only; little explicit policy | Low |

## Practical Implications For This Project

### 1. The current heuristic direction is broadly aligned with public human advice

The strongest repeated public themes are:

- open more tiles
- think ahead
- avoid bad duplicate pairing choices
- reduce structural pressure points

Those are already central to the current engine and analyzer.

### 2. The current heuristics are strongest where public advice is strongest

This is encouraging.

The engine is not chasing random theoretical signals. Its main heuristics align
with the advice that human strategy guides repeat most often.

### 3. The biggest gap is not conceptual alignment; it is human validation

The research here supports the plausibility of the analyzer's current metrics as
human-difficulty proxies, but it does not prove them.

The next step is still to validate whether boards with higher:

- downstream pair-choice spread
- low unlock counts
- high stack pressure
- high branch regret or hint pressure

actually feel harder or fairer to real players.

The next layer after that may be to use the softer advice themes from these
guides to shape future heuristics around visual and perceptual difficulty, not
just objective search-space pressure.

### 4. Tool usage should become part of future validation

Because so many public guides talk about undo, hint, and restart behavior,
future session telemetry should treat these as first-class human-facing
difficulty signals rather than mere UI usage counters.

## Summary

Public Mahjong Solitaire advice is surprisingly consistent.

Across the reviewed sources, the repeated human-facing lessons are:

- prefer moves that unlock the board
- clear structural pressure points such as top tiles, stacks, and choke points
- think ahead rather than taking the first legal pair
- handle duplicate tile choices carefully
- use hints, undo, and restart strategically rather than reactively

Those themes map well onto the current engine's heuristic model. The strongest
matches are unlocked-tile pressure, pair-choice consequence, delayed
punishment, and structural stack pressure.

## Conclusion

Using public strategy advice as a proxy for human difficulty is imperfect, but
it is still useful.

This research suggests that the current generator is pointed in the right
direction: many of the board characteristics that public guides say players
should fear are already the same characteristics this engine tries to author and
measure.

The biggest remaining challenge is not inventing new heuristic ideas. It is
validating whether the current analyzer's search-space metrics track real human
friction, regret, and perceived difficulty closely enough to tune against with
confidence.

At the same time, this review suggests that future tuning should not be limited
only to the objectively measured structural model. Public strategy advice also
contains useful hints about softer difficulty factors such as visual cues,
perceived choke points, and board readability.

That makes future player-session logging, repeated-board analysis, and
low-friction deployment more important than adding large new heuristic families
right away.

## End Notes

<a id="ref-1"></a>[1] Truc, Miljan. "Best Strategies, Tips, and Tricks to Win at Mahjong Solitaire." *FRVR*, 29 July 2025, https://frvr.com/tutorials/mahjong-solitaire-tips-and-tricks/. Accessed 12 Apr. 2026.

<a id="ref-2"></a>[2] "How to Play Mahjong Solitaire (Beginner Guide + Tips)." *Vita Mahjong*, https://vita-mahjong.org/how-to-play-mahjong-solitaire. Accessed 12 Apr. 2026.

<a id="ref-3"></a>[3] "9 Mahjong Tips to Master the Game." *Mahjong Online 365*, https://www.mahjongonline365.com/tips/mahjong-tips. Accessed 12 Apr. 2026.

<a id="ref-4"></a>[4] Bharti, Vijaya. "Mahjong Solitaire - Free Online Card Game." *MPL Games*, 25 July 2025, https://www.mplgames.com/solitaire/mahjong-solitaire. Accessed 12 Apr. 2026.

<a id="ref-5"></a>[5] "Mahjongg Strategy - How to Win at Mahjongg." *MahjongFun*, https://www.mahjongfun.com/strategy/. Accessed 12 Apr. 2026.

<a id="ref-6"></a>[6] "Mahjong Solitaire: Complete Tile Matching Guide." *Classic Games Online*, https://freegamehub.org/guides/mahjong-solitaire-guide. Accessed 12 Apr. 2026.

<a id="ref-7"></a>[7] "3 Common Mahjong Mistakes Even Advanced Players Make - And How to Fix Them." *TheMahjong.io*, https://themahjong.io/blog/mahjong-mistakes-and-fixes. Accessed 12 Apr. 2026.

<a id="ref-8"></a>[8] "How to Play Mahjong Solitaire: Complete Beginner's Guide (2026)." *Mahjong Boss*, 7 Feb. 2026, https://mahjongboss.com/blog/how-to-play-mahjong-solitaire.html. Accessed 12 Apr. 2026.

<a id="ref-9"></a>[9] Narkiewicz, Adam. "Mahjong Solitaire Strategy Guide." *Mahjong Pro*, 6 Sept. 2025, https://mahjong-pro.com/mahjong-solitaire-strategy-guide/. Accessed 12 Apr. 2026.
