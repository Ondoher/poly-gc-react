import AnalyticAngularDiskSource from './AnalyticAngularDiskSource.js';

export default class LambertSphereDiskSource extends AnalyticAngularDiskSource {
    constructor({ id, packet, angularRadiusRadians, centerDirectionCamera, phaseAngleRadians, baseRadianceScale = 1 }) {
        const phaseFactor = (Math.sin(phaseAngleRadians)
            + (Math.PI - phaseAngleRadians) * Math.cos(phaseAngleRadians)) / Math.PI;
        const radianceScale = (2 / 3) * baseRadianceScale * phaseFactor;
        const scaledPacket = {
            ...packet,
            values: packet.values.map((value) => value * radianceScale),
        };
        super({ id, packet: new packet.constructor({
            quantity: packet.quantity,
            units: packet.units,
            basis: packet.basis,
            values: scaledPacket.values,
            provenance: {
                ...packet.provenance,
                sourceId: `${packet.provenance.sourceId}-lambert-${phaseAngleRadians}`,
                sourceVersion: 'er3-lambert-phase-fixture',
                sourceHashSha256: packet.provenance.sourceHashSha256,
            },
            uncertainty: packet.uncertainty,
        }), angularRadiusRadians, centerDirectionCamera });
        this.phaseAngleRadians = phaseAngleRadians;
        this.phaseFactor = phaseFactor;
        this.radianceScale = radianceScale;
    }
}

