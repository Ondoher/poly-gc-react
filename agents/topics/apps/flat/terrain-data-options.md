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
- Already used by the Flat false-simulation floor texture.
- Source: https://www.naturalearthdata.com/

## Implementation Notes

- Keep terrain generation as a build/preprocess step or explicit user action,
  not automatic app startup network work.
- Cache local height grids as app assets with attribution metadata.
- Convert source lat/lon/elevation samples to a local ENU grid around the
  observer before the renderer sees them.
- Generate a horizon profile from the grid by azimuth. Store the maximum
  elevation angle per azimuth bin for star/sky occlusion.
- For flat false simulation, decide whether local terrain is rendered as real
  terrain around the observer, as terrain predicted by the false projection, or
  both in separate comparison modes.

## Open Questions

- Should the first terrain pass use Mapzen Terrain Tiles for speed, or should
  we start directly with Copernicus DEM for a more canonical global source?
- Should USGS 3DEP be added later as an optional U.S. high-resolution override
  behind the same provider interface?
- What local radius should the first mesh use: `5 km`, `25 km`, `100 km`, or a
  control-panel setting?
- Should the default checked-in sample be San Jose-only, or should the app
  fetch/cache terrain per selected observer later?
- Do we need bare-earth terrain only, or is a surface model with buildings and
  trees acceptable for the first visual pass?
- Which vertical datum conversions matter before the renderer uses elevations
  as local meters?
