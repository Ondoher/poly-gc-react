# Atmosflat32 Distant Source Abstraction Baseline

Status: accepted (9 passed, 0 failed, 0 unresolved, 0 not-applicable).

This POC artifact routes the default Figure 1 distant directional Sun through a
runtime source object while preserving the copied Algorithm32 step-032 transport
and display behavior.

Generated domes:

- figure1-06h00-z87-figure1-four-view-source-k-no-ground.png
- figure1-10h15-z41-figure1-four-view-source-k-no-ground.png
- figure1-11h15-z31-figure1-four-view-source-k-no-ground.png
- figure1-13h15-z21-figure1-four-view-source-k-no-ground.png

Image parity:

- tmp/atmosphere/atmosflat32/019-distant-source-abstraction-baseline/figure1-06h00-z87-figure1-four-view-source-k-no-ground.png: maxAbsRgbDelta=0, maxAbsAlphaDelta=0, exactBytes=true
- tmp/atmosphere/atmosflat32/019-distant-source-abstraction-baseline/figure1-10h15-z41-figure1-four-view-source-k-no-ground.png: maxAbsRgbDelta=0, maxAbsAlphaDelta=0, exactBytes=true
- tmp/atmosphere/atmosflat32/019-distant-source-abstraction-baseline/figure1-11h15-z31-figure1-four-view-source-k-no-ground.png: maxAbsRgbDelta=0, maxAbsAlphaDelta=0, exactBytes=true
- tmp/atmosphere/atmosflat32/019-distant-source-abstraction-baseline/figure1-13h15-z21-figure1-four-view-source-k-no-ground.png: maxAbsRgbDelta=0, maxAbsAlphaDelta=0, exactBytes=true

Selected-ray parity summary:

- max radiance absolute delta: 0
- max radiance relative delta: 0
- max second-order absolute delta: 0
- max direct Sun transmittance delta: 0

Criteria:

- source-abstraction-used-by-sky-radiance-path: pass
- only-distant-directional-sun-active: pass
- all-four-step032-domes-generated-at-320x320: pass
- encoded-image-parity-with-step032: pass
- selected-spectral-radiance-parity: pass
- no-direct-solar-disc-camera-radiance: pass
- sample-to-sun-transmittance-unchanged: pass
- second-order-distant-sun-cache-behavior-unchanged: pass
- display-conversion-post-transport-consumer: pass

Notes:

- This is POC experiment code, not production/shared app code.
- No unit tests were added.
- Display images are report artifacts derived from recorded transport output.
