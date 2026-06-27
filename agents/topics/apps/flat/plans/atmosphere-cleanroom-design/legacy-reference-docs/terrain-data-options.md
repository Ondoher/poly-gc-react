# Flat Terrain Data Options

This note tracks candidate elevation sources for drawing coarse local terrain
around the selected observer. Terrain should stay optional and provider-backed:
the renderer should consume a small normalized local height grid, not know where
the data came from.

## Recommended Shape

Start with a terrain provider abstraction that can produce a compact local
asset:

```text
observer lat/lon + radius -> local height grid + source metadata
```

The app-facing output should be something like:

- `observer`: selected lat/lon/elevation reference
- `radiusKm`: local terrain window radius
- `gridSize`: likely `129` or `257` samples per side for the first mesh
- `heightsMeters`: row-major terrain elevations
- `verticalDatum`: source datum when known
- `source`: provider name, product, access date, attribution, and URL

Both flat and spherical views should consume this same local height grid. The
views can project and render it differently.

## First-Pass Recommendation

The ultimate app will support city selection and manual lat/lon input, so the
default terrain path should be global from the start.

Use **Mapzen Terrain Tiles on AWS** for the first implementation because the
data is already tiled, global, and easy to request around an observer. It is
not the most canonical source, but it is the fastest path to a working local
terrain mesh anywhere the app lets the user move.

Use the **Terrarium PNG** tile format for the first pass. Decode each pixel as:

```text
elevationMeters = (red * 256 + green + blue / 256) - 32768
```

The first visible terrain pass should be deliberately small and cached:

- observer: current default San Jose root
- radius: `25 km` to `50 km`
- grid: `129 x 129` samples first, `257 x 257` only if performance and visual
  framing are comfortable
- source: Mapzen Terrain Tiles Terrarium PNGs from the public AWS terrain tile
  bucket
- output: checked-in/generated local terrain asset with heights and source
  metadata, not network fetch on app startup
- render: one indexed local terrain mesh centered on the observer, using real
  kilometer/meter scale and the same sun/atmosphere composition path as other
  solid objects
- first replacement target: reduce or remove the synthetic red mountain
  rectangles once the local terrain mesh provides enough horizon context

Evaluate **Copernicus DEM GLO-30/GLO-90** as the longer-term canonical global
DEM source if we want direct, source-stable DEM products instead of composited
web terrain tiles.

Treat **USGS 3DEP** as an optional U.S.-quality upgrade, not the default
terrain contract. It is still useful for San Jose/default development and
high-resolution U.S. terrain, but the app should not depend on U.S.-only
coverage.

## Candidate Sources

### USGS 3DEP

- Best quality upgrade for U.S. locations, not the global default.
- High-quality elevation data, often lidar-derived.
- Includes high-resolution products such as Seamless 1 Meter DEM.
- USGS states 3DEP products are free of charge and without use restrictions.
- Good choice for San Jose/local U.S. terrain once we want a better mesh.
- Source: https://www.usgs.gov/3d-elevation-program

### Mapzen Terrain Tiles

- Best first prototype provider.
- Global bare-earth terrain heights in S3-backed web tiles.
- No AWS account required for public bucket access.
- Aggregates sources such as 3DEP, SRTM, GMTED, ArcticDEM, EUDEM, and other
  national datasets depending on region and zoom.
- Supports app-friendly tile formats such as Terrarium PNG, GeoTIFF, and Skadi
  HGT tiles.
- Source: https://registry.opendata.aws/terrain-tiles/
- Source details: https://github.com/tilezen/joerd/blob/master/docs/data-sources.md
- Formats: https://github.com/tilezen/joerd/blob/master/docs/formats.md

### Copernicus DEM

- Best canonical global DEM candidate.
- GLO-30 provides worldwide 30 m coverage; GLO-90 provides worldwide 90 m
  coverage.
- Free worldwide license, with attribution obligations.
- Strong candidate for non-U.S. locations if we want a direct DEM source
  instead of composited terrain tiles.
- More operationally involved than Mapzen tiles.
- Source: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM

### NASADEM / SRTM

- Good simple near-global fallback.
- NASADEM provides 1 arc-second / roughly 30 m elevation in 1 degree tiles.
- Coverage is land between about `60N` and `56S`, about 80 percent of Earth's
  landmass.
- Well known and easy to reason about, but radar/tree/building artifacts and
  coverage gaps matter.
- Source: https://www.earthdata.nasa.gov/data/catalog/lpcloud-nasadem-hgt-001

### NOAA ETOPO 2022

- Good coarse global relief context, including topography and bathymetry.
- Available at 15, 30, and 60 arc-second resolutions.
- Useful for broad Earth/ocean context, not detailed local horizon terrain.
- Source: https://www.ncei.noaa.gov/products/etopo-global-relief-model

### GEBCO

- Good global ocean/land terrain and bathymetry source.
- Current grid is 15 arc-second interval global terrain.
- Better for ocean/bathymetry context than local observer terrain.
- Source: https://www.gebco.net/data-products/gridded-bathymetry-data

### Natural Earth

- Useful for broad map context, coastlines, land/water, and shaded relief.
- Not detailed enough for local terrain or horizon masking.
- Already used by the Flat flat-simulation floor texture.
- Source: https://www.naturalearthdata.com/

## Implementation Notes

- Keep terrain generation as a build/preprocess step or explicit user action,
  not automatic app startup network work.
- Cache local height grids as app assets with attribution metadata.
- Put provider/tile/decode math in framework-free model/helper code, not in
  React components.
- Convert source lat/lon/elevation samples to a local ENU grid around the
  observer before the renderer sees them.
- For the first flat-simulation renderer, map local ENU as `eastKm -> x`,
  `northKm -> z`, and `(elevationMeters - observer.elevationMeters) / 1000 ->
  y`.
- Render the first terrain mesh as solid depth-bearing geometry so the
  atmosphere composer can attenuate it by real camera-to-surface distance.
- Generate a horizon profile from the grid by azimuth. Store the maximum
  elevation angle per azimuth bin for star/sky occlusion. This can follow the
  first visible mesh; it does not need to block the initial terrain pass.
- For flat flat simulation, decide whether local terrain is rendered as real
  terrain around the observer, as terrain predicted by the false projection, or
  both in separate comparison modes.

## Shortest Implementation Path

1. Add a terrain module under
   `src/flat/features/flat-simulation/models/local-terrain.js` or promote to
   `src/flat/shared/terrain` if the first helper is immediately view-agnostic.
2. Implement Web Mercator tile coverage for a lat/lon/radius window.
3. Add a small script or explicit generation command that downloads Terrarium
   PNG tiles for San Jose and writes a normalized local height-grid asset under
   a flat feature asset path.
4. Add source metadata beside the generated grid: provider, product, tile
   format, source URLs, access date, observer, radius, grid size, and vertical
   datum when known.
5. Add a renderer component that turns the grid into one indexed terrain mesh,
   lit by the current sun path and rendered through `FlatAtmosphereComposer`.
6. Keep synthetic mountain rectangles available as a fallback until the terrain
   mesh is visually useful, then disable them by default.

## Open Questions

- Should USGS 3DEP be added later as an optional U.S. high-resolution override
  behind the same provider interface?
- After the San Jose fixture works, should terrain be generated on demand by a
  local script, cached per selected observer, or fetched by a backend route?
- Do we need bare-earth terrain only, or is a surface model with buildings and
  trees acceptable for the first visual pass?
- Which vertical datum conversions matter before the renderer uses elevations
  as local meters?
