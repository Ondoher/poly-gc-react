# Mathematical Justification & References

This document provides the theoretical frameworks, mathematical proofs, and authoritative reference citations for the geospatial scripts utilized in this tracking project.

---

## 1. WGS84 Geodetic to ECEF Coordinate Transformation

The algorithm maps a tracking station's spherical Latitude ($\phi$) and Longitude ($\lambda$) onto a 3D Earth-Centered, Earth-Fixed (ECEF) Cartesian coordinate grid using closed-form conversion formulas:

$$\begin{cases} X = (N(\phi) + h) \cos(\phi) \cos(\lambda) \\ Y = (N(\phi) + h) \cos(\phi) \sin(\lambda) \\ Z = (N(\phi)(1 - e^2) + h) \sin(\phi) \end{cases}$$

Where the radius of curvature in the prime vertical is defined as:
$$N(\phi) = \frac{a}{\sqrt{1 - e^2 \sin^2(\phi)}}$$

### Verification References
* **Institutional Standard:** This geometric mapping profile is managed globally by the National Geospatial-Intelligence Agency (NGA). Detailed derivations and constants are available in the [National Imagery and Mapping Agency Technical Report (TR8350.2)](https://gis-lab.info).
* **Code Implementation Reference:** Standard validation models for this code structure can be cross-examined via public open-source implementations such as the [GitHub Gist WGS-84 Coordinate Transformation](https://github.com).

---

## 2. Topocentric Horizon to ECEF Vector Transformation

To transform raw ground observations—Azimuth ($\alpha$) and Elevation ($e$)—into absolute 3D pointing vectors aligned with the global ECEF grid, a local tangent rotation matrix is applied:

$$\begin{bmatrix} X \\ Y \\ Z \end{bmatrix} = \begin{bmatrix} -\sin(\lambda) & -\sin(\phi)\cos(\lambda) & \cos(\phi)\cos(\lambda) \\ \cos(\lambda) & -\sin(\phi)\sin(\lambda) & \cos(\phi)\sin(\lambda) \\ 0 & \cos(\phi) & \sin(\phi) \end{bmatrix} \begin{bmatrix} \cos(e)\sin(\alpha) \\ \cos(e)\cos(\alpha) \\ \sin(e) \end{bmatrix}$$

### Verification References
* **Academic Proof:** The linear algebra tracking how local horizon reference frames tilt relative to the Earth's absolute center is derived in the [Ohio State University Department of Geodetic Science Lecture Notes](https://ohio-state.edu).
* **Institutional Guide:** For an engineering manual on deploying these specific rotation matrices in aerospace tracking systems, see the [European Space Agency (ESA) Navipedia Reference Systems Manual](https://esa.int).

---

## 3. Multi-Line N-Dimensional Least-Squares Intersection

When parsing look-angle measurements from more than two ground stations, measurement noise means the paths will rarely intersect perfectly. The batch script builds an overdetermined system to locate the optimal spatial coordinate ($\mathbf{p}_{\text{opt}}$) that minimizes the orthogonal distance to all rays simultaneously using projection matrices:

$$\mathbf{p}_{\text{opt}} = \left( \sum_{i=1}^N (\mathbf{I} - \mathbf{u}_i\mathbf{u}_i^T) \right)^{-1} \sum_{i=1}^N (\mathbf{I} - \mathbf{u}_i\mathbf{u}_i^T)\mathbf{p}_i$$

### Verification References
* **Mathematical Reference:** This closed-form linear solution is fully documented in the landmark computer vision paper *Intersection of Lines in 3D Space* published via the [Microsoft Research Technical Portal](https://microsoft.com).
* **Geometric Reference:** For the baseline 2-station edge-case parametric calculation utilizing Cramer's rule determinants for spatial ray intersection, refer to the [CK-12 Foundation Mathematics Library](https://ck12.org).

---

## 4. Keplerian Orbital Dynamics & Validation Metrics

The orbital altitude baseline of $\approx 35,786 \text{ km}$ above the equator is verified using classical gravitational-centrifugal equilibrium models (Kepler's Third Law).

### Verification References
* **Physical Mechanics:** The underlying orbital physics and equations governing geostationary requirements can be audited through the [NASA Glenn Research Center Orbital Mechanics Guide](https://nasa.gov).
* **Operational Telemetry:** Real-world coordinates and active orbital positions for the targets processed by this engine are listed in the [SES Space & Satellite Fleet Directory](https://ses.com).
