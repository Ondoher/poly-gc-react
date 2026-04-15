# Mahjongg Engine Design Notes

This document holds design framing, cleanup ideas, and future-facing notes for
the Mahjongg engine. The companion `README.md` is meant to describe the current
system as it exists today.

## Picker Framing

One useful distinction in the current difficulty system is between the picker's
natural structural scoring and the smaller set of controls that are truly
intended as difficulty dials.

### Natural Picker Weights

These are part of how the picker understands the board:

- z bias
- horizontal intersection weighting
- vertical intersection weighting
- freed-count ranking

These feel more like the picker's built-in opinion about which open tiles are
structurally significant than like player-facing tuning knobs.

### Difficulty Dials

These are the controls that materially push generation toward easier or harsher
outcomes:

- difficulty window position
- suspension intensity and suspension safety thresholds
- open-pressure strength
- balance-pressure strength
- short-horizon pressure
- face-avoidance strength

This distinction is mostly about framing and reducing calling surface. A future
cleanup may want to keep the structural picker model stable and expose only the
smaller set of real difficulty controls.

## Future Considerations

### Board Difficulty Versus UI Assist Difficulty

The current work only tunes board construction pressure, but perceived
difficulty can also be shaped by player tools such as:

- hints
- undo
- shuffle
- move highlighting
- blocked-tile previews

A future design could pair authored board difficulty levels with UI-assist
presets, or expose them as separate controls.

Another useful distinction is between:

- objective structural difficulty that can be measured directly in the board and
  search space
- softer perceptual difficulty driven by visual salience, readability, obvious
  choke points, and how legible dangerous structures are to a human player

The current system is much stronger on the first category than the second.
Public strategy-guide research suggests the second category is also important,
so future tuning may want to use those softer cues more deliberately.

### Center-Distance Picker Weight

Another future experiment is a center-distance weighting factor that plays a
role similar to the current z bias.

The idea would be:

- easy favors tiles farther from the layout center so the outer ends clear
  sooner
- hard preserves those outer-end tiles longer so the board keeps more lateral
  spread and edge pressure

This would likely belong with the picker's natural structural scoring first,
not as a headline product dial. The main question is whether "distance from the
layout center" is a useful proxy for the kinds of side-blocking and outer-edge
cleanup behavior that make a board feel easier once the flanks start peeling
away.

If it proves useful, it could become a support factor that complements z bias
and reference intersections rather than replacing them.

### Reduce Public Picker Knobs

Another possible cleanup is to treat z bias and reference-intersection
weighting as part of the picker's natural scoring model rather than as
first-class difficulty knobs.

That would mostly be an API and framing cleanup:

- the picker keeps its structural opinion about which tiles matter
- public tuning stays focused on the dials that materially change difficulty

## Related References

- `agents/topics/difficulty/difficulty-measurement.md`
- `agents/topics/difficulty/difficulty-tuning-knobs.md`
- `agents/topics/difficulty/strategy-advice-proxy-research.md`
- `scripts/difficulty/cli.js`
- `scripts/difficulty/tune-levels.js`
