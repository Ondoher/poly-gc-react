# Mathematical Justification & References

This document explains the coordinate transforms and reference geometry used by
the satellite pointing calculator.

---

## 1. WGS84 Geodetic to ECEF Coordinate Transformation

The app maps an observer's latitude ($\phi$), longitude ($\lambda$), and height
($h$) onto an Earth-Centered, Earth-Fixed (ECEF) Cartesian coordinate grid using
the WGS84 ellipsoid.

$$\begin{cases} X = (N(\phi) + h) \cos(\phi) \cos(\lambda) \\ Y = (N(\phi) + h) \cos(\phi) \sin(\lambda) \\ Z = (N(\phi)(1 - e^2) + h) \sin(\phi) \end{cases}$$

The prime vertical radius of curvature is:

$$N(\phi) = \frac{a}{\sqrt{1 - e^2 \sin^2(\phi)}}$$

### Verification References

* **Institutional Standard:** WGS84 is maintained by the National Geospatial-Intelligence Agency (NGA). NGA describes WGS84 as the targeting and navigation grid used for GPS positioning in its [GPS and Earth Orientation Products](https://www.nga.mil/resources/GPS_and_Earth_Orientation_Products.html) resource page.
* **Current WGS84 Reference Frame:** NGA publishes the current terrestrial reference frame details in [WGS 84 (G2296) Terrestrial Reference Frame](https://earth-info.nga.mil/php/download.php?file=WGS+84%28G2296%29.pdf).

---

## 2. Topocentric Horizon to ECEF Vector Transformation

To transform a satellite line-of-sight vector into local dish-pointing values,
the app rotates the ECEF delta vector into the observer's local East, North, Up
(ENU) frame:

$$\begin{bmatrix} E \\ N \\ U \end{bmatrix} = \begin{bmatrix} -\sin(\lambda) & \cos(\lambda) & 0 \\ -\sin(\phi)\cos(\lambda) & -\sin(\phi)\sin(\lambda) & \cos(\phi) \\ \cos(\phi)\cos(\lambda) & \cos(\phi)\sin(\lambda) & \sin(\phi) \end{bmatrix} \begin{bmatrix} \Delta X \\ \Delta Y \\ \Delta Z \end{bmatrix}$$

The local slant range ($\rho$), azimuth ($A$), and elevation ($e$) are then:

$$\rho = \sqrt{E^2 + N^2 + U^2}$$

$$A = \operatorname{atan2}(E, N)$$

$$e = \sin^{-1}\left(\frac{U}{\rho}\right)$$

### Verification References

* **Coordinate Frame Derivation:** ESA Navipedia's [Transformations between ECEF and ENU coordinates](https://gssc.esa.int/navipedia/index.php/Transformations_between_ECEF_and_ENU_coordinates) gives the East/North/Up basis vectors, the ECEF-to-ENU rotation matrix, and the azimuth/elevation formulas used by the app.
* **Implementation Cross-Check:** Fixposition's [Converting from ECEF to ENU](https://docs.fixposition.com/fd/converting-from-ecef-to-enu-local-frame) summarizes the same ECEF/local-frame conversion pattern used in GNSS tooling.

---

## 3. Multi-Line N-Dimensional Least-Squares Intersection

This inverse mode is not part of the current interactive app, but the prototype
script includes it as a possible future mode. When parsing look-angle
measurements from more than two ground stations, measurement noise means the
paths will rarely intersect perfectly. The batch script builds an
overdetermined system to locate the optimal spatial coordinate
($\mathbf{p}_{\text{opt}}$) that minimizes the orthogonal distance to all rays
simultaneously using projection matrices:

$$\mathbf{p}_{\text{opt}} = \left( \sum_{i=1}^N (\mathbf{I} - \mathbf{u}_i\mathbf{u}_i^T) \right)^{-1} \sum_{i=1}^N (\mathbf{I} - \mathbf{u}_i\mathbf{u}_i^T)\mathbf{p}_i$$

### Verification References

* **Least-Squares Form:** The [Least-Squares Intersection of Lines](https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection#Least-Squares_Intersection_of_Lines) section of the line-line intersection reference derives the projection-matrix form for the point closest to many lines.
* **Implementation Reference:** MATLAB Central's [Line-Line Intersection (N lines, D space)](https://www.mathworks.com/matlabcentral/fileexchange/59805-line-line-intersection-n-lines-d-space) documents the same "nearest to all lines by minimum sum of squared distances" problem in implementation form.

---

## 4. Geosynchronous Orbit Altitude & ASTRA Validation

The app uses the standard geosynchronous altitude baseline of about
$35,786 \text{ km}$ above Earth's equator. For the ASTRA meme-check page, the
reference slot is ASTRA 2E/2F/2G at 28.2 degrees East.

### Verification References

* **GEO Altitude:** NASA describes geosynchronous equatorial orbit as a circular orbit [22,236 miles above Earth](https://www.nasa.gov/science-research/tech-research/groundbreaking-technology-may-add-years-to-earth-orbiting-satellites/), the same altitude scale as the app's 35,786 km GEO assumption.
* **Operational Satellite Neighborhood:** SES lists [ASTRA 2E/2F/2G at 28.2 degrees East](https://www.ses.com/v2/solutions/media-broadcasters/reach-neighborhoods) in its media reach and orbital-neighborhood material.
