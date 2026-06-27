# Algorithm32 source abstraction with the default distant directional Sun

Status: evaluated by criteria-results.json.

This artifact proves the first atmosflat32 milestone: the default Figure 1
distant directional Sun is routed through a runtime source object while the
copied Algorithm32 step-032 transport and display output remain unchanged.

The active source adapter is `distant-directional-sun`. It returns one
infinite-distance source sample at each atmosphere sample position, with the
same direction, spectral solar irradiance, and sample-to-top-atmosphere
visibility/transmittance meaning used by experiment 032. No local Sun,
finite-size Sun body, shader path, app integration, or production API is part
of this run.

Acceptance evidence:

- generated the four Figure 1 sky domes at 320 x 320;
- compared each generated PNG against the accepted step-032 reference PNG;
- compared selected rays between the copied legacy path and source-object path;
- verified the no-direct-solar-disc camera-radiance policy;
- verified display conversion remains a post-transport consumer.

Generated outputs:

- figure1-06h00-z87-figure1-four-view-source-k-no-ground.png
- figure1-10h15-z41-figure1-four-view-source-k-no-ground.png
- figure1-11h15-z31-figure1-four-view-source-k-no-ground.png
- figure1-13h15-z21-figure1-four-view-source-k-no-ground.png

Next step:

Use this accepted default-source baseline as the handoff before adding a local
or flat Sun adapter. Keep new source-specific behavior in the source object,
geometry helper, or cache-plan boundary rather than adding branches through the
Algorithm32 transport loops.
