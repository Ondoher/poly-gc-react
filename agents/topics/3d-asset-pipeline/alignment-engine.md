# Alignment Engine

This document explains why the aligner does more than a direct shape-to-shape
match.

## Mental Model

Reference images own semantic structure, but source SVGs can decompose artwork
in very different ways. A source dot may be one path, several paths, a reused
symbol instance, a grouped shape, or a compound path with cutouts. The aligner
bridges those decomposition differences without making final review decisions.

## Non-Semantic Source IDs

Source component ids are extraction ids, not semantic ids. They are stable
enough for one normalized artifact and review pass, but the name itself should
not imply dot, bamboo, label, glyph, or artwork meaning.

## Reference Groups

Reference parts provide compatible targets. Related parts can be solved as a
group so the aligner can compare the shape of a full layout rather than only
isolated nearest neighbors.

Examples:

- dots in a suited face
- bamboo strokes that should move together
- character artwork composed of multiple strokes
- free-form main artwork

## Optional Reservations

Optional Part Assignment reserves accepted label/glyph components before
alignment. The aligner should not steal those components for ordinary artwork.
Accepted source absence for optional parts also constrains alignment; absence
does not mean generated output.

## Source Components And Shapes

Normalization emits both low-level components and source shapes. Shapes group
components that behave as a cohesive visual unit, such as one expanded
`data-source-use` instance or layered same-parent components. Alignment can
choose either level when building candidates.

## Grouping Strategies

The aligner may compare direct components, grouped source shapes, repeated
sets, free-form artwork groups, and generated placement records. The important
output is the selected compact match and placement needed by assignment and
rendering.

## Fit Policies

Fit policy depends on reference role and family:

- direct placement for simple repeated parts
- group fit for related artwork
- largest containing box for suit-level layouts such as dragons
- generated placement into reference target bounds for generated labels/glyphs
- free-form artwork placement using accepted alignment transforms

## Identity Inside Repeated Groups

A good geometric fit does not always identify each repeated member. A slanted
source layout may need one axis for fit and another axis for member identity.
The aligner keeps enough selected match information for downstream code to
preserve exact source/reference correspondence where color and output policy
need it.

## Score Meaning

Alignment score is geometric evidence. It is useful for ranking candidates and
diagnostics, but it is not a durable confidence field. Accepted bindings and
part state are the durable review result.

## Generated And Skipped Groups

Generated optional parts may participate as placement concepts so the
layout can be solved, but final rendering recreates generated glyph geometry
from reference target bounds and rendering policy. Skipped or absent source
parts remain explicit review state, not hidden alignment output.

## Diagnostics

Diagnostics should explain ambiguous cases, missing candidates, skipped
components, low-quality fits, and identity hazards. They should not become
runtime state unless a later consumer has a concrete contract for them.
