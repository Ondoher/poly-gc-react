// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER1 fixture decisions.
// - fixture HTTP headers and retained raw payloads beside this file's fixtures directory.

import { freezeJsonValue } from '../provenance/stableHash.js';

export const EXTERNAL_CELESTIAL_FIXTURE_MANIFEST = freezeJsonValue({
    manifestVersion: 3,
    acquisitionPolicy:
        'Pinned immutable/versioned URL plus retained bytes and SHA-256; mutable current aliases are prohibited.',
    acquiredAtUtc: '2026-07-12',
    siriusCalspec: {
        sourceId: 'stsci-calspec-sirius',
        sourceVersion: 'sirius_stis_005',
        fileName: 'sirius_stis_005.fits',
        byteLength: 282240,
        sourceHashSha256: '1349da7b8b59ad035aefea8d7948f552b41b3897d07e5ad82ca162a53af97271',
        pinnedUrl:
            'https://archive.stsci.edu/hlsps/reference-atlases/cdbs/calspec/sirius_stis_005.fits',
        mutableAliasProhibited:
            'https://archive.stsci.edu/hlsps/reference-atlases/cdbs/current_calspec/sirius_stis_005.fits',
        documentationUrl:
            'https://www.stsci.edu/hst/instrumentation/reference-data-for-calibration-and-tools/astronomical-catalogs/calspec',
        doi: '10.17909/t9-khb7-4049',
        httpLastModified: 'Thu, 27 Oct 2022 01:09:58 GMT',
        httpEtag: '44e80-5ebf9ccbfd1ec',
        contentType: 'image/fits',
        quantity: 'spectral-irradiance-density',
        originalUnits: 'erg s^-1 cm^-2 Angstrom^-1',
        convertedUnits: 'W m^-2 nm^-1',
        conversionFactor: 0.01,
        wavelengthState: 'vacuum; composite already adjusted for radial velocity -6.0 km/s',
        expectedTargetId: 'SIRIUS',
        expectedPedigree: 'INFLIGHT 1997 to 2022',
        expectedRowCount: 8970,
        expectedMinimumAngstroms: 1150.2,
        expectedMaximumAngstroms: 2996862.5500922,
        catalogRoundedMaximumAngstroms: 2996862.55,
        dataQualityPolicy: 'Use DATAQUAL=1 only; fail if a canonical-bin interval needs another row.',
        visibleSegment: 'Measured STIS segment 1675..10200 Angstrom covers all canonical bins.',
        uncertaintyQualification:
            'Retain STATERROR and SYSERROR separately; nominal 1% systematics may understate uncertainty for saturated bright-star observations.',
        sourceUsePolicy:
            'Absolute Earth-observer F_lambda; never apply a second visual-magnitude scale.',
    },
    gaiaEdr3PassbandsV2: {
        sourceId: 'gaia-edr3-dr3-passbands',
        sourceVersion: 'version-2',
        fileName: 'GaiaEDR3_passbands_zeropoints_version2.zip',
        byteLength: 27941,
        sourceHashSha256: 'd22a1d765a2e3e6815a9cb7e9bf0cf999c4bd1473148c0b031e57e6aac0e3b8f',
        pinnedUrl:
            'https://www.cosmos.esa.int/documents/29201/4226701/GaiaEDR3_passbands_zeropoints.zip/b03ab6ac-8b02-9850-7586-7dd7cdbc84c9?t=1603980987171',
        landingUrl: 'https://www.cosmos.esa.int/web/gaia/edr3-passbands',
        releasePaperDoi: '10.1051/0004-6361/202039587',
        releasePaperBibcode: '2021A&A...649A...3R',
        httpLastModified: 'Thu, 09 Sep 2021 14:42:09 GMT',
        selectedBand: 'G',
        responseUnits: 'dimensionless',
        sourceUnitsLabelQualification:
            'ReadMe labels transmissivity fields mag; those fields are dimensionless response.',
        missingSentinelPolicy: '99.99 means undefined and becomes zero response with a retained flag.',
        photometrySystem: 'synthetic AB',
        zeroPointPolicy:
            'Do not apply packaged 25.x catalogue zero points to CALSPEC physical flux.',
        supportQualification:
            'Full Gaia G is 320..1100 nm; compare 15-channel output only on identical clipped 360..830 nm support.',
    },
    canonicalSolar: {
        sourceId: 'algorithm32-canonical-astm-g173-etr',
        sourceVersion: 'accepted-15-channel-center-interpolation-v1',
        fileName: 'astmg173.zip',
        byteLength: 25833,
        sourceHashSha256: 'de6ed831cd7426d9a7147d5c0a48b1e67a483cb7f8ecd6d3ae846848154a5657',
        sourcePage: 'https://www.nrel.gov/grid/solar-resource/spectra-am1.5',
        tableTitle: 'ASTM G173-03 Reference Spectra Derived from SMARTS v. 2.9.2',
        tableEntry: 'ASTMG173.csv',
        sourceColumn: 'Etr W*m-2*nm-1',
        quantity: 'spectral-irradiance-density',
        units: 'W m^-2 nm^-1',
        runtimeOwner:
            'scripts/flat/reconciliation/POC/src/constants/consts.js#CANONICAL_SPECTRAL_CHANNELS',
        rawPayloadRole:
            'Provenance/audit payload only; it does not replace or fork the accepted runtime owner.',
    },
    tsis1HsrsV2: {
        sourceId: 'lasp-tsis1-hybrid-solar-reference-spectrum',
        sourceVersion: 'HSRS-v2-2022EA002637',
        fileName: 'tsis1_hsrs_1nm.csv',
        byteLength: 1298915,
        sourceHashSha256: '1cf3b07e6ac9669c429ad7ce9e92d50dfd741422efcfffa3d1e0eeb5f901616f',
        pinnedUrl: 'https://lasp.colorado.edu/lisird/latis/dap/tsis1_hsrs_1nm.csv',
        datasetDoi: '10.25980/ta3f-7h90',
        paperDoi: '10.1029/2022EA002637',
        quantity: 'spectral-irradiance-density',
        units: 'W m^-2 nm^-1',
        uncertaintyUnits: 'W m^-2 nm^-1',
        wavelengthSupportNanometers: [202, 2730],
        sampleCount: 25281,
        commonSupportGateNanometers: [360, 830],
        referenceRole:
            'Independent modern solar absolute-scale comparison; never a second runtime Sun owner.',
        uncertaintyPolicy:
            'Integrate the published standard-uncertainty density as fully correlated for a conservative common-support bound.',
    },
    rieke2023SiriusAbsoluteCalibration: {
        sourceId: 'rieke-2023-sirius-visible-through-mid-infrared-calibration',
        sourceVersion: 'AJ-165-99-published-2023',
        fileName: 'rieke-2023-absolute-calibration-iii.pdf',
        byteLength: 1262848,
        sourceHashSha256: '752967e0ca7d13997824bbe2894b8bc625ddc9c4b81c02ef43545fb01039280c',
        pinnedUrl:
            'https://openresearch-repository.anu.edu.au/bitstreams/7566b264-4d1e-48c6-92db-871815597356/download',
        publicationDoi: '10.3847/1538-3881/ac9f1b',
        visibleReference: {
            wavelengthNanometers: 555.75,
            fluxWattsPerSquareMeterPerNanometer: 1.3436e-10,
            standardUncertaintyWattsPerSquareMeterPerNanometer: 0.0081e-10,
            coefficientSource: 'Table 1',
            comparisonWindowNanometers: [554.5, 557],
        },
        msxReference: {
            pivotWavelengthMicrometers: 2.1603,
            fluxWattsPerSquareCentimeterPerMicrometer: 15.20e-14,
            standardUncertaintyWattsPerSquareCentimeterPerMicrometer: 0.21e-14,
            coefficientSource: 'Table 3, MSX row',
            fitWindowMicrometers: [2, 2.31],
            excludedBrackettGammaMicrometers: [2.14, 2.18],
        },
        referenceRole:
            'Independent Sirius absolute-scale anchors; does not validate every canonical spectral channel.',
    },
    msxSpiritIiiResponses: {
        sourceId: 'msx-spirit-iii-relative-spectral-responses',
        sourceVersion: 'MSX-point-source-catalog-v1.2',
        baseUrl: 'https://irsa.ipac.caltech.edu/data/MSX/docs/rsr/',
        files: [
            {
                band: 'A',
                fileName: 'msx_rsr_a.tbl',
                byteLength: 13697,
                sourceHashSha256: 'dcdb6d607ecd983fa0e8fbdac12c31cc2f4cd92175d77b718a9cfd18ea170f99',
            },
            {
                band: 'C',
                fileName: 'msx_rsr_c.tbl',
                byteLength: 6282,
                sourceHashSha256: '55abc0027286771e674245da3d6efcffc78ba9648927daa8cc0ad5f6da36ad83',
            },
            {
                band: 'D',
                fileName: 'msx_rsr_d.tbl',
                byteLength: 8682,
                sourceHashSha256: '935461d3c1dc7c54d0cd52c23d7acc4d6cb5699eb7ed18ec391f353ad56ab3a0',
            },
            {
                band: 'E',
                fileName: 'msx_rsr_e.tbl',
                byteLength: 24018,
                sourceHashSha256: 'fff30ea8aa95316e2a1613f54b2b2b860f03597eb56845ab2bd8db3f4452b795',
            },
        ],
        units: {
            wavelength: 'micrometer',
            response: 'dimensionless',
        },
        referenceRole:
            'Instrument provenance for the Rieke Table-3 MSX absolute anchor; the POC does not refit the published MSX transfer.',
    },
    airLusi2022: {
        sourceId: 'nist-air-lusi-2022-lunar-spectral-irradiance',
        sourceVersion: 'official-2024-12-19-open-release',
        fileName: 'air_lusi_spectra.nc',
        byteLength: 471191,
        sourceHashSha256: 'ab428b8e91ca02cbcd4f154cb5e524dada87514447bb3384af318d255bb9459a',
        doi: '10.18434/mds2-3397',
        landingUrl: 'https://data.nist.gov/od/id/mds2-3397',
        repositoryUrl: 'https://github.com/usnistgov/air-lusi',
        repositoryHeadAtAcquisition: '91f100a161bdf4205c8bbfef5dd5c30e33cbe995',
        payloadCommit: '098c63aaee0b197054721eb7dcc4f73bfde10871',
        pinnedUrl:
            'https://media.githubusercontent.com/media/usnistgov/air-lusi/098c63aaee0b197054721eb7dcc4f73bfde10871/data/air_lusi_spectra.nc',
        payloadSelectionQualification:
            'Use the DOI-bearing open GitHub payload. The data.nist.gov direct file endpoint served older prepublication bytes during acquisition and is not the retained identity.',
        quantity: 'disk-integrated spectral irradiance density',
        units: 'microW m^-2 nm^-1',
        convertedUnits: 'W m^-2 nm^-1',
        conversionFactor: 1e-6,
        standardizedDistances: {
            sunMoonAstronomicalUnits: 1,
            observerMoonKilometers: 384400,
        },
        shape: [4, 834],
        wavelengthSupportNanometers: [381.46416970645413, 1039.8334622762197],
        wavelengthState: 'vacuum',
        uncertaintyState:
            'Total_rel_err is dimensionless relative standard uncertainty (k=1); retain the stated omitted 0.3% uniformity qualification.',
        canonicalCoverage:
            'Fully covers canonical bins 2..15. Canonical bin 1 is only partially sampled and requires a separately qualified reference.',
        license:
            'NIST public-service/open-data terms embedded in the NetCDF; acknowledge NIST and retain the notice.',
    },
    rolo311g: {
        sourceId: 'usgs-rolo-lunar-irradiance-model-311g',
        sourceVersion: '311g-published-2005',
        fileName: 'kieffer-stone-2005-rolo-311g.pdf',
        byteLength: 461609,
        sourceHashSha256: '1666a5414916c2e38fcf34097aad3794cc1aae9d4a7d090bef2a049219316e96',
        pinnedUrl:
            'https://oceancolor.gsfc.nasa.gov/SeaWiFS/On_Orbit/lcal/docs/kieffer_stone_irradiance_moon_aj.pdf',
        publicationDoi: '10.1086/430185',
        coefficientSource: 'Table 4 and equation 10',
        quantity: 'dimensionless disk-equivalent lunar reflectance',
        wavelengthSupportNanometers: [350, 2383.6],
        referenceRole:
            'Qualified independent model complement for canonical bin 1 only; Air-LUSI remains the decisive XA-G09 measurement.',
        uncertaintyQualification:
            'USGS reports about 1% relative model precision and several-percent absolute-scale uncertainty; the blue-bin comparison uses a predeclared 15% tolerance.',
    },
    cometMathsInterpolation: {
        sourceId: 'comet-maths-interpolation-reference',
        sourceVersion: '1.0.8',
        fileName: 'comet_maths-1.0.8.tar.gz',
        byteLength: 46748,
        sourceHashSha256: 'd8c245e45b62d1be79c209257018110af0c866d60016c95e0bf88b940d618e4c',
        pinnedUrl:
            'https://files.pythonhosted.org/packages/fb/48/feda1a53693f790b23e9e80550d7a269b9c1d2e01d605944e6a3b02f7ad0/comet_maths-1.0.8.tar.gz',
        packageIndex: 'https://pypi.org/project/comet-maths/1.0.8/',
        implementationEntry: 'comet_maths/interpolation/interpolation.py',
        implementationDependencies: {
            numpy: '1.26.4',
            scipy: '1.13.1',
        },
        role:
            'Authoritative interpolation-model uncertainty semantics and SciPy-compatible quadratic/cubic oracle; not a runtime dependency.',
        license: 'LGPL-3.0',
    },
    limeLunarCandidate: {
        sourceId: 'esa-lime-lunar-reflectance-model',
        sourceVersion: 'LIME-TBX-v1.4.1-model-20251010_v1-asd-v2.0.0-atbd-v3.3',
        release: {
            fileName: 'lime_tbx-v1.4.1.zip',
            byteLength: 132331903,
            sourceHashSha256: '2731da32927c9933a0ff728719069f4b75099ff33fe1b8c48ab5e39f9a7926b5',
            pinnedUrl: 'https://github.com/LIME-ESA/lime_tbx/archive/refs/tags/v1.4.1.zip',
            releaseUrl: 'https://github.com/LIME-ESA/lime_tbx/releases/tag/v1.4.1',
            annotatedTagObject: '4d31ca31249562269686514e2fdec15c41f784b1',
            commit: '82edc07dfdc6a0de2e7a6bd73a8674cd33c2edd1',
            tagQualification:
                'Unsigned and not guaranteed immutable; retained payload hash is authoritative.',
            implementationLicense: 'LGPL-3.0',
        },
        coefficients: {
            fileName: 'LIME_MODEL_COEFS_20251010_V01.nc',
            modelId: '20251010_v1',
            byteLength: 154366,
            sourceHashSha256: '8e6839d95315eb2d797484be559ad70b69010cc1eb9b614770f61bb5ce2cf691',
            pinnedUrl:
                'https://raw.githubusercontent.com/LIME-ESA/lime_tbx/v1.4.1/coeff_data/versions/LIME_MODEL_COEFS_20251010_V01.nc',
            gitBlobSha1: 'e4844ee96f6b308eff9d61b4bce76b6cd5bc570b',
            embeddedEntry:
                'lime_tbx-1.4.1/coeff_data/versions/LIME_MODEL_COEFS_20251010_V01.nc',
            byteIdenticalToEmbeddedEntry: true,
            variables: ['coeff', 'u_coeff', 'err_corr_coeff', 'wavelength'],
            licenseQualification:
                'Repository declares LGPL-3.0; coefficient NetCDF has no separate file-level license statement.',
            selectionGuard:
                'Explicitly select 20251010_v1 and assert exported reference_model; pinned listv.txt still names an older default.',
        },
        spectralReference: {
            sourceVersion: 'ASD-v2.0.0',
            zenodoDoi: '10.5281/zenodo.17332582',
            zenodoUrl: 'https://zenodo.org/records/17332582/files/LIME_ASD.nc?download=1',
            embeddedEntry:
                'lime_tbx-1.4.1/lime_tbx/business/interpolation/interp_data/assets/ds_ASD_32.nc',
            byteLength: 43488052,
            sourceHashSha256: '360044078e42d31ff5e9dffb085f5b3bd455db30a7b46a82c4f68c96fc4b522d',
            sourceMd5: '77996dac3ef0c29edc5b965993df0d2b',
            embeddedAndZenodoByteIdentical: true,
            license: 'CC BY 4.0',
        },
        atbd: {
            fileName: 'LIME-Model-ATBD-v3.3.pdf',
            byteLength: 3809214,
            sourceHashSha256: 'fc3c8e88f7c9821aa81e856cea0e5aa61e2ac43bd55b09d5b01a7758fc706598',
            pinnedUrl:
                'https://lime.uva.es/wp-content/uploads/2025/11/D5_LIME_ModelATBD_final.pdf',
            version: '3.3',
            date: '2025-11-02',
        },
        implementationEntries: {
            changelog: 'lime_tbx-1.4.1/CHANGELOG.md',
            reflectanceEvaluator:
                'lime_tbx-1.4.1/lime_tbx/business/lime_algorithms/lime/elref.py',
            irradianceEvaluator:
                'lime_tbx-1.4.1/lime_tbx/business/lime_algorithms/lime/eli.py',
            spectralInterpolation:
                'lime_tbx-1.4.1/lime_tbx/business/interpolation/spectral_interpolation/spectral_interpolation.py',
            interpolationSettings:
                'lime_tbx-1.4.1/coeff_data/interp_settings.yml',
            cimelResponses:
                'lime_tbx-1.4.1/lime_tbx/business/spectral_integration/assets/responses_1088.csv',
            defaultTsisSolarReference:
                'lime_tbx-1.4.1/lime_tbx/business/lime_algorithms/lime/assets/tsis_fwhm_3_1_gaussian.csv',
        },
        candidateQuantity: 'dimensionless disk-equivalent lunar reflectance A_lambda',
        domain: 'absolute phase angle <= 90 degrees',
        fittedAnchorsNanometers: [440, 500, 675, 870, 1020, 1640],
        canonicalIntervalFittedAnchorsNanometers: [440, 500, 675],
        resolvedRadianceQualification:
            'Disk-integrated photometry only; a separate normalized disk profile is required for resolved radiance.',
        spectralQualification:
            'ASD gaps use Apollo/model assistance, including 300..400 and 809..840 nm; preserve covariance and per-region qualification.',
        solarQualification:
            'LIME absolute scale uses TSIS-1. ER5 retains the Algorithm32 canonical Sun and treats the exact TSIS/canonical transfer as deterministic calibration, not random uncertainty.',
        er1Status: 'sealed-research-candidate-not-executed-or-calibrated',
    },
});
