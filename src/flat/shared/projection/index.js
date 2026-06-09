import ProjectionModel from './ProjectionModel.js';
import NorthPoleAzimuthalEquidistantEarthProjection from './earth/NorthPoleAzimuthalEquidistantEarthProjection.js';
import NorthCelestialPoleAzimuthalEquidistantProjection from './celestial/NorthCelestialPoleAzimuthalEquidistantProjection.js';
import UpperHemisphereRadialLiftProjection from './sky-surface/UpperHemisphereRadialLiftProjection.js';

ProjectionModel.registerEarthProjection(new NorthPoleAzimuthalEquidistantEarthProjection());
ProjectionModel.registerCelestialProjection(new NorthCelestialPoleAzimuthalEquidistantProjection());
ProjectionModel.registerSkySurfaceProjection(new UpperHemisphereRadialLiftProjection());

export {
	ProjectionModel,
	NorthPoleAzimuthalEquidistantEarthProjection,
	NorthCelestialPoleAzimuthalEquidistantProjection,
	UpperHemisphereRadialLiftProjection,
};
