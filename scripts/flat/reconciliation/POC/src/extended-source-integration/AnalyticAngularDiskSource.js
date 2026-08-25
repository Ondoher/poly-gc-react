import ExternalCelestialSource from '../external-celestial-sources/ExternalCelestialSource.js';
import { EXTENDED_CELESTIAL_SOURCE } from '../external-celestial-sources/consts.js';

export default class AnalyticAngularDiskSource {
    constructor({ id, packet, angularRadiusRadians, centerDirectionCamera, limbCoefficient = 0 }) {
        this.id = id;
        this.packet = packet;
        this.angularRadiusRadians = angularRadiusRadians;
        this.centerDirectionCamera = Object.freeze([...centerDirectionCamera]);
        this.limbCoefficient = limbCoefficient;
        this.source = new ExternalCelestialSource({
            id,
            kind: EXTENDED_CELESTIAL_SOURCE,
            geometry: {
                kind: 'analytic-angular-disk',
                owner: 'ER3 analytic extended-source fixture',
                angularRadiusRadians,
                centerDirectionCamera: this.centerDirectionCamera,
                limbCoefficient,
            },
            spectralMeasure: packet,
        });
    }

    radianceForSample(sample) {
        const profile = this.limbCoefficient === 0
            ? 1
            : (1 - this.limbCoefficient * sample.rhoSquared)
                / (1 - this.limbCoefficient / 2);
        return Object.freeze(this.packet.values.map((value) => value * profile));
    }
}
