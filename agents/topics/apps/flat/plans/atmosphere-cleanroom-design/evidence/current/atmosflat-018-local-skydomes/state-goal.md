# Flat App Rotation Skydome Diagnostics

Goal: generate first-order Algorithm32 flat/local observer angular sky images
for the app-config false Sun placement at closest San Jose approach and at 45,
90, 135, and 180 degrees away around the same fixed-latitude rotation, using
an artificial cap whose footprint radius matches the round atmosphere horizon
radius as a skydome-renderer ray length limit, plus a calibrated local-source
brightness whose closest approach matches the distant-Sun unit incident scale.

Success criteria:

- use app configuration only for the San Jose root and false-Sun definition;
- independently derive all source positions and observer source samples;
- treat each source-to-sample distance as the configured finite local Sun
  distance for the source sample;
- compute source incident scale from the configured inverse-square radiance
  falloff model after calibrating the closest observer sample to distant-Sun
  unit incident scale, not from a post-render brightness proxy;
- render each angular sky view through the same fisheye image loop as the
  round Algorithm32 domes, but with flat altitude, a renderer-owned artificial
  cap ray length limit, and the finite source sample contract;
- keep generated PNGs as pure observer sky views, with source marker
  diagnostics in JSON instead of painted into the image;
- generate one 320 x 320 angular sky PNG per requested offset;
- defer local-source second-order cache work explicitly.

Status: accepted
