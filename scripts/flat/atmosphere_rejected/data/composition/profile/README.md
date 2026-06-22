# Atmosphere Profile Data

`us-standard-atmosphere-1976-density.json` stores selected density-ratio
checkpoints from the PDAS SI table based on the U.S. Standard Atmosphere 1976.
The first policy use is molecular Rayleigh density scaling in sky-patch
comparisons.

The profile is deliberately table-backed. It is not a new implementation of
the full standard atmosphere equations, and it does not yet replace aerosol or
ozone vertical-profile policies.
