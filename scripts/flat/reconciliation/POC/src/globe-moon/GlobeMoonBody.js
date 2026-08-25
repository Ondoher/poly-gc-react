export default class GlobeMoonBody {
    constructor({ centerKm, radiusKm, opaque = true }) {
        if (!Array.isArray(centerKm) || centerKm.length !== 3 || !centerKm.every(Number.isFinite)) throw new TypeError('Moon centerKm must be a finite vector3.');
        if (!Number.isFinite(radiusKm) || radiusKm <= 0) throw new TypeError('Moon radiusKm must be positive.');
        this.centerKm = Object.freeze([...centerKm]); this.radiusKm = radiusKm; this.opaque = opaque === true;
    }

    /** Intersect a normalized ray with the physical Moon sphere. */
    intersectRay({ originKm, direction }) {
        const oc = subtract(originKm, this.centerKm);
        const a = dot(direction, direction);
        const halfB = dot(oc, direction);
        const c = dot(oc, oc) - this.radiusKm * this.radiusKm;
        const discriminant = halfB * halfB - a * c;
        if (discriminant < 0) return Object.freeze({ hit: false, distanceKm: null, opaque: this.opaque });
        const root = Math.sqrt(discriminant);
        const near = (-halfB - root) / a;
        const far = (-halfB + root) / a;
        const distanceKm = near >= 0 ? near : far >= 0 ? far : null;
        return Object.freeze({ hit: distanceKm !== null, distanceKm, opaque: this.opaque });
    }
}

function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
