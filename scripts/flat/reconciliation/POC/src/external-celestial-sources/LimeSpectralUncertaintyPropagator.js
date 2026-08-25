// References:
// - LIME Model ATBD v3.3, sections 2.6 and 2.7.
// - LIME-TBX v1.4.1 spectral interpolation and CIMEL response correction.
// - SciPy make_interp_spline not-a-knot construction for degrees 2 and 3.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER5.

import { LIME_REFERENCE_MOON_SOLID_ANGLE_STERADIANS } from './consts.js';

const RELEASE_INTERPRETATION = 'lime-v1.4.1-positional';
const ATBD_INTERPRETATION = 'atbd-v3.3-named';
const RELEASE_SRF_SIGN = 'release-point-minus-srf';
const ATBD_SRF_SIGN = 'atbd-srf-minus-point';
const JACOBIAN_TOLERANCE = 1e-6;
const COVARIANCE_SYMMETRY_TOLERANCE = 1e-10;
const WAVELENGTH_CORRELATION_SYMMETRY_TOLERANCE = 2e-7;
const PHASE_CORRELATION_SYMMETRY_TOLERANCE = 1e-12;
const COMPONENT_SUM_TOLERANCE = 1e-12;

/**
 * Propagate LIME coefficient and ASD uncertainty into joint canonical spectra.
 */
export default class LimeSpectralUncertaintyPropagator {
    /**
     * Build fixed sampling, response, binning, and interpolation operators.
     *
     * @param {Readonly<Record<string, unknown>>} configuration - LIME model, fixtures, and canonical basis.
     */
    constructor({ model, fixtures, basis }) {
        if (!model || !fixtures || !basis) {
            throw new Error('LIME spectral uncertainty requires model, fixtures, and basis.');
        }
        this.model = model;
        this.fixtures = fixtures;
        this.basis = basis;
        this.asdWavelengths = Float64Array.from(fixtures.asd.wavelength.values);
        this.asdPhaseAngles = Float64Array.from(fixtures.asd.phaseAngle.values);
        this.anchorWavelengths = Float64Array.from(model.coefficientWavelengths);
        this.channelCount = basis.channels.length;
        this.wavelengthCount = this.asdWavelengths.length;
        this.anchorCount = this.anchorWavelengths.length;
        this.coefficientCount = model.coefficientValues.length;
        this.phaseCount = this.asdPhaseAngles.length;

        this._validateDimensions();
        this.pointOperator = this._buildPointOperator();
        this.srfOperator = this._buildSrfOperator();
        this.binOperator = this._buildBinOperator();
        this.reflectanceOutputOperator = this.createOutputOperator({
            id: 'canonical-bin-average-reflectance',
            quantity: 'dimensionless-disk-equivalent-reflectance',
            units: '1',
            spectralWeights: new Float64Array(this.wavelengthCount).fill(1),
            channelScales: new Float64Array(this.channelCount).fill(1),
            qualification:
                'Exact bin average of the reconstructed hyperspectral LIME reflectance.',
        });
        this.tsisReferenceOutputOperators = this._buildTsisReferenceOutputOperators();
        this.releaseSrfOperator = subtractMatrices(
            this.pointOperator,
            this.srfOperator,
        );
        this.atbdSrfOperator = scaleMatrix(this.releaseSrfOperator, -1);
        this.interpolationOperators = Object.freeze({
            linear: this._buildInterpolationOperator(1, 'linear'),
            quadraticNotAKnot: this._buildInterpolationOperator(
                2,
                'quadratic-not-a-knot',
            ),
            cubicNotAKnot: this._buildInterpolationOperator(
                3,
                'cubic-not-a-knot',
            ),
        });

        this.coefficientCorrelation = toFlatFloat64(
            model.coefficientErrorCorrelation
                ?? fixtures.coefficients.errorCorrelation.values,
            'LIME coefficient correlation',
        );
        this.wavelengthCorrelation = toFlatFloat64(
            fixtures.asd.wavelengthCorrelation.values,
            'LIME ASD wavelength correlation',
        );
        this.phaseCorrelation = toFlatFloat64(
            fixtures.asd.phaseCorrelation.values,
            'LIME ASD phase correlation',
        );
        this.coefficientStandardUncertainties = Float64Array.from(
            model._absoluteCoefficientUncertainties(),
        );
        this.inputCorrelationDiagnostics = Object.freeze({
            coefficient: this._validateCorrelation(
                this.coefficientCorrelation,
                this.coefficientCount,
                COVARIANCE_SYMMETRY_TOLERANCE,
                'LIME coefficient correlation',
            ),
            asdWavelength: this._validateCorrelation(
                this.wavelengthCorrelation,
                this.wavelengthCount,
                WAVELENGTH_CORRELATION_SYMMETRY_TOLERANCE,
                'LIME ASD wavelength correlation',
            ),
            asdPhase: this._validateCorrelation(
                this.phaseCorrelation,
                this.phaseCount,
                PHASE_CORRELATION_SYMMETRY_TOLERANCE,
                'LIME ASD phase correlation',
            ),
            usePolicy:
                'Use the arithmetic mean of each retained off-diagonal pair after reporting the source asymmetry.',
        });
        symmetrizeSquareMatrixInPlace(
            this.coefficientCorrelation,
            this.coefficientCount,
        );
        symmetrizeSquareMatrixInPlace(
            this.wavelengthCorrelation,
            this.wavelengthCount,
        );
        symmetrizeSquareMatrixInPlace(this.phaseCorrelation, this.phaseCount);
    }

    /**
     * Build an output operator from wavelength weights and per-channel scales.
     *
     * The operator applies the wavelength weights inside each exact bin integral,
     * so callers do not need to approximate a weighted spectrum with products of
     * separately binned values.
     *
     * @param {LimeOutputOperatorConfiguration} configuration - Output identity, units, wavelength weights, and channel scales.
     * @returns {LimeOutputOperator} Reusable fifteen-by-ASD output operator.
     */
    createOutputOperator({
        id,
        quantity,
        units,
        spectralWeights,
        channelScales,
        qualification = '',
    }) {
        if (typeof id !== 'string' || id.length === 0) {
            throw new Error('LIME output operator requires a nonempty id.');
        }
        const weights = toFlatFloat64(spectralWeights, id + ' spectral weights');
        const scales = toFlatFloat64(channelScales, id + ' channel scales');
        if (
            weights.length !== this.wavelengthCount
            || scales.length !== this.channelCount
            || weights.some((value) => !Number.isFinite(value))
            || scales.some((value) => !Number.isFinite(value))
        ) {
            throw new Error('LIME output operator weights or scales have invalid dimensions.');
        }
        const values = new Float64Array(this.binOperator.length);
        for (let channel = 0; channel < this.channelCount; channel += 1) {
            const offset = channel * this.wavelengthCount;
            for (let wavelength = 0; wavelength < this.wavelengthCount; wavelength += 1) {
                values[offset + wavelength] = this.binOperator[offset + wavelength]
                    * weights[wavelength] * scales[channel];
            }
        }
        return Object.freeze({
            id,
            quantity,
            units,
            qualification,
            shape: Object.freeze([this.channelCount, this.wavelengthCount]),
            spectralWeights: weights,
            channelScales: scales,
            values,
            diagnostics: summarizeWeightedOperatorRows(
                values,
                this.channelCount,
                this.wavelengthCount,
            ),
        });
    }

    /**
     * Return the exact TSIS-weighted irradiance and effective-reflectance operators.
     *
     * @returns {Readonly<Record<string, unknown>>} Built-in TSIS reference transforms.
     */
    createTsisReferenceOutputOperators() {
        return this.tsisReferenceOutputOperators;
    }

    /**
     * Propagate a nonempty ordered list of LIME requests or model evaluations.
     *
     * @param {readonly unknown[] | Readonly<Record<string, unknown>>} input - Requests, evaluations, or an object containing either list.
     * @param {string | Readonly<Record<string, unknown>> | null} [outputTransform=null] - Built-in id, reusable operator, or custom operator configuration.
     * @returns {LimeJointUncertaintyResult} Joint central values, covariance components, and diagnostics.
     */
    propagate(input, outputTransform = null) {
        const evaluations = this._normalizeEvaluations(input);
        const outputOperator = this._resolveOutputOperator(outputTransform);
        const states = evaluations.map((evaluation) => this._buildBranchState(
            evaluation,
            this.interpolationOperators.linear.values,
            this.releaseSrfOperator,
            outputOperator.values,
            RELEASE_SRF_SIGN,
            'linear',
        ));
        const outputCount = evaluations.length * this.channelCount;
        const outputs = Object.freeze(evaluations.flatMap((evaluation, evaluationIndex) =>
            this.basis.channels.map((channel, channelIndex) => Object.freeze({
                outputIndex: evaluationIndex * this.channelCount + channelIndex,
                evaluationIndex,
                requestId: evaluation.request.id,
                signedPhaseDegrees: evaluation.request.signedPhaseDegrees,
                asdPhaseIndex: evaluation.asd.phaseIndex,
                channelIndex,
                channelId: channel.id,
                centerNanometers: channel.centerNanometers,
                lowerBoundNanometers: channel.lowerBoundNanometers,
                upperBoundNanometers: channel.upperBoundNanometers,
            }))));
        const centralValues = concatenateVectors(states.map((state) => state.z));

        const coefficientSensitivity = this._buildCoefficientSensitivity(
            evaluations,
            states,
        );
        const coefficientCovariance = sandwichCorrelation(
            coefficientSensitivity,
            outputCount,
            this.coefficientCount,
            this.coefficientCorrelation,
        );

        const asdSensitivity = this._buildAsdSensitivity(evaluations, states);
        const asdWavelengthCovariance = sandwichCorrelation(
            asdSensitivity,
            outputCount,
            this.wavelengthCount,
            this.wavelengthCorrelation,
        );
        const asdCovariance = this._applyPhaseCorrelation(
            asdWavelengthCovariance,
            evaluations,
        );

        const interpolationEnsemble = this._buildInterpolationEnsemble(
            evaluations,
            outputOperator.values,
        );
        const srfSignEnsemble = this._buildSrfSignEnsemble(
            evaluations,
            outputOperator.values,
        );
        const totalCovariance = sumMatrices([
            coefficientCovariance,
            asdCovariance,
            interpolationEnsemble.covariance,
            srfSignEnsemble.covariance,
        ]);
        const componentSumResidual = maximumMatrixDifference(
            totalCovariance,
            sumMatrices([
                coefficientCovariance,
                asdCovariance,
                interpolationEnsemble.covariance,
                srfSignEnsemble.covariance,
            ]),
        );
        if (componentSumResidual > COMPONENT_SUM_TOLERANCE) {
            throw new Error(
                'LIME covariance components do not reconstruct the total covariance.',
            );
        }

        const covarianceDiagnostics = Object.freeze({
            coefficient: this._validateCovariance(
                coefficientCovariance,
                outputCount,
                'coefficient covariance',
            ),
            asdWavelengthAndPhase: this._validateCovariance(
                asdCovariance,
                outputCount,
                'ASD wavelength/phase covariance',
            ),
            interpolationEnsemble: this._validateCovariance(
                interpolationEnsemble.covariance,
                outputCount,
                'interpolation ensemble covariance',
            ),
            srfSign: this._validateCovariance(
                srfSignEnsemble.covariance,
                outputCount,
                'SRF-sign covariance',
            ),
            total: this._validateCovariance(
                totalCovariance,
                outputCount,
                'total covariance',
            ),
            componentSumMaximumAbsoluteResidual: componentSumResidual,
            componentSumTolerance: COMPONENT_SUM_TOLERANCE,
        });
        const standardUncertainties = diagonalStandardUncertainties(
            totalCovariance,
            outputCount,
        );
        const jacobianChecks = Object.freeze(evaluations.map((evaluation, index) =>
            this._checkJacobiansForState(
                evaluation,
                states[index],
                outputOperator.values,
            )));
        const maximumJacobianScaledError = Math.max(...jacobianChecks.map((check) =>
            Math.max(
                check.anchorSensitivity.maximumScaledError,
                check.asdSensitivity.maximumScaledError,
            )));
        if (maximumJacobianScaledError > JACOBIAN_TOLERANCE) {
            throw new Error(
                'LIME analytic sensitivity failed its finite-difference check: '
                + maximumJacobianScaledError + ' > ' + JACOBIAN_TOLERANCE + '.',
            );
        }

        const modelAgreement = Object.freeze(evaluations.map((evaluation, index) =>
            this._compareCentralPrediction(
                evaluation,
                states[index],
                outputOperator,
            )));
        return Object.freeze({
            method: 'lime-joint-canonical-spectral-uncertainty-v1',
            centralBranch: Object.freeze({
                coefficientInterpretation: RELEASE_INTERPRETATION,
                srfSign: RELEASE_SRF_SIGN,
                interpolation: 'linear',
                outputTransform: Object.freeze({
                    id: outputOperator.id,
                    quantity: outputOperator.quantity,
                    units: outputOperator.units,
                    qualification: outputOperator.qualification,
                }),
            }),
            dimensions: Object.freeze({
                evaluationCount: evaluations.length,
                channelsPerEvaluation: this.channelCount,
                outputCount,
                covarianceShape: Object.freeze([outputCount, outputCount]),
                coefficientVariableCount: this.coefficientCount,
                asdWavelengthCount: this.wavelengthCount,
                asdPhaseCount: this.phaseCount,
            }),
            outputs,
            centralValues: freezeVector(centralValues),
            branchPredictions: Object.freeze({
                interpolation: Object.freeze({
                    linear: freezeVector(interpolationEnsemble.branches[0]),
                    quadraticNotAKnot: freezeVector(interpolationEnsemble.branches[1]),
                    cubicNotAKnot: freezeVector(interpolationEnsemble.branches[2]),
                    ensembleMean: freezeVector(interpolationEnsemble.mean),
                    covarianceConvention:
                        'population covariance over three globally stacked method branches',
                }),
                srfSign: Object.freeze({
                    releasePointMinusSrf: freezeVector(srfSignEnsemble.branches[0]),
                    atbdSrfMinusPoint: freezeVector(srfSignEnsemble.branches[1]),
                    ensembleMean: freezeVector(srfSignEnsemble.mean),
                    covarianceConvention:
                        'population covariance over two globally stacked sign branches with linear interpolation held fixed',
                }),
            }),
            covariance: Object.freeze({
                coefficient: freezeMatrix(coefficientCovariance, outputCount),
                asdWavelengthAndPhase: freezeMatrix(asdCovariance, outputCount),
                interpolationEnsemble: freezeMatrix(
                    interpolationEnsemble.covariance,
                    outputCount,
                ),
                srfSign: freezeMatrix(srfSignEnsemble.covariance, outputCount),
                total: freezeMatrix(totalCovariance, outputCount),
            }),
            standardUncertainty: Object.freeze({
                values: freezeVector(standardUncertainties),
                relativeValues: freezeVector(Float64Array.from(
                    standardUncertainties,
                    (value, index) => value / centralValues[index],
                )),
            }),
            correlation: Object.freeze({
                total: freezeMatrix(
                    covarianceToCorrelation(totalCovariance, outputCount),
                    outputCount,
                ),
            }),
            diagnostics: Object.freeze({
                operators: this._describeOperators(outputOperator),
                inputCorrelations: this.inputCorrelationDiagnostics,
                covariance: covarianceDiagnostics,
                sensitivities: Object.freeze({
                    coefficient: summarizeRows(
                        coefficientSensitivity,
                        outputCount,
                        this.coefficientCount,
                    ),
                    asd: summarizeRows(
                        asdSensitivity,
                        outputCount,
                        this.wavelengthCount,
                    ),
                }),
                jacobianChecks,
                maximumJacobianScaledError,
                jacobianTolerance: JACOBIAN_TOLERANCE,
                centralPredictionAgreement: modelAgreement,
            }),
        });
    }

    /**
     * Check analytic anchor and ASD sensitivities for one request or evaluation.
     *
     * @param {unknown} requestOrEvaluation - One LIME request or completed evaluation.
     * @param {string | Readonly<Record<string, unknown>> | null} [outputTransform=null] - Output operator selection.
     * @returns {Readonly<Record<string, unknown>>} Finite-difference comparison diagnostics.
     */
    checkJacobians(requestOrEvaluation, outputTransform = null) {
        const [evaluation] = this._normalizeEvaluations([requestOrEvaluation]);
        const outputOperator = this._resolveOutputOperator(outputTransform);
        const state = this._buildBranchState(
            evaluation,
            this.interpolationOperators.linear.values,
            this.releaseSrfOperator,
            outputOperator.values,
            RELEASE_SRF_SIGN,
            'linear',
        );
        return this._checkJacobiansForState(
            evaluation,
            state,
            outputOperator.values,
        );
    }

    /**
     * Evaluate the four predeclared coefficient-order and interpolation variants.
     *
     * This method keeps the release point-minus-SRF correction fixed and changes
     * only the two unresolved authority dimensions. It returns deterministic
     * branch vectors and does not reinterpret their spread as covariance.
     *
     * @param {readonly unknown[] | Readonly<Record<string, unknown>>} input - Requests, evaluations, or an object containing either list.
     * @param {string | Readonly<Record<string, unknown>> | null} [outputTransform=null] - Built-in id, reusable operator, or custom operator configuration.
     * @returns {Readonly<Record<string, unknown>>} Globally stacked authority-variant outputs and comparisons.
     */
    evaluateAuthorityVariants(input, outputTransform = null) {
        const evaluations = this._normalizeEvaluations(input);
        const outputOperator = this._resolveOutputOperator(outputTransform);
        const atbdEvaluations = Object.freeze(evaluations.map((evaluation) =>
            Object.freeze({
                ...evaluation,
                anchorEvaluation: this.model._evaluateAnchors(
                    evaluation.request.geometry,
                    ATBD_INTERPRETATION,
                ),
            })));
        const branchConfigurations = Object.freeze([
            Object.freeze({
                id: 'release-positional-native-linear',
                coefficientInterpretation: RELEASE_INTERPRETATION,
                coefficientOrder: 'release-positional-native',
                interpolation: this.interpolationOperators.linear,
                evaluations,
            }),
            Object.freeze({
                id: 'release-positional-cubic-not-a-knot',
                coefficientInterpretation: RELEASE_INTERPRETATION,
                coefficientOrder: 'release-positional-native',
                interpolation: this.interpolationOperators.cubicNotAKnot,
                evaluations,
            }),
            Object.freeze({
                id: 'atbd-table-order-linear',
                coefficientInterpretation: ATBD_INTERPRETATION,
                coefficientOrder: 'atbd-table-order',
                interpolation: this.interpolationOperators.linear,
                evaluations: atbdEvaluations,
            }),
            Object.freeze({
                id: 'atbd-table-order-cubic-not-a-knot',
                coefficientInterpretation: ATBD_INTERPRETATION,
                coefficientOrder: 'atbd-table-order',
                interpolation: this.interpolationOperators.cubicNotAKnot,
                evaluations: atbdEvaluations,
            }),
        ]);
        const branches = Object.freeze(branchConfigurations.map((configuration) => {
            const values = concatenateVectors(configuration.evaluations.map((evaluation) =>
                this._buildBranchState(
                    evaluation,
                    configuration.interpolation.values,
                    this.releaseSrfOperator,
                    outputOperator.values,
                    RELEASE_SRF_SIGN,
                    configuration.interpolation.id,
                ).z));
            return Object.freeze({
                id: configuration.id,
                coefficientInterpretation: configuration.coefficientInterpretation,
                coefficientOrder: configuration.coefficientOrder,
                interpolation: Object.freeze({
                    id: configuration.interpolation.id,
                    degree: configuration.interpolation.degree,
                    boundaryCondition: configuration.interpolation.boundaryCondition,
                    tailPolicy: configuration.interpolation.tailPolicy,
                }),
                srfSign: RELEASE_SRF_SIGN,
                values: freezeVector(values),
            });
        }));
        const outputCount = evaluations.length * this.channelCount;
        const outputs = Object.freeze(evaluations.flatMap((evaluation, evaluationIndex) =>
            this.basis.channels.map((channel, channelIndex) => Object.freeze({
                outputIndex: evaluationIndex * this.channelCount + channelIndex,
                evaluationIndex,
                requestId: evaluation.request.id,
                signedPhaseDegrees: evaluation.request.signedPhaseDegrees,
                asdPhaseIndex: evaluation.asd.phaseIndex,
                channelIndex,
                channelId: channel.id,
                centerNanometers: channel.centerNanometers,
                lowerBoundNanometers: channel.lowerBoundNanometers,
                upperBoundNanometers: channel.upperBoundNanometers,
                outputQuantity: outputOperator.quantity,
                outputUnits: outputOperator.units,
            }))));
        const comparisons = Object.freeze({
            releaseLinearVersusReleaseCubic: compareBranchVectors(
                branches[0].values,
                branches[1].values,
            ),
            releaseLinearVersusAtbdLinear: compareBranchVectors(
                branches[0].values,
                branches[2].values,
            ),
            releaseCubicVersusAtbdCubic: compareBranchVectors(
                branches[1].values,
                branches[3].values,
            ),
            atbdLinearVersusAtbdCubic: compareBranchVectors(
                branches[2].values,
                branches[3].values,
            ),
        });
        return Object.freeze({
            method: 'lime-authority-variants-v1',
            qualification:
                'Deterministic authority branches only; this method does not add or modify covariance.',
            fixedSrfSign: RELEASE_SRF_SIGN,
            outputTransform: Object.freeze({
                id: outputOperator.id,
                quantity: outputOperator.quantity,
                units: outputOperator.units,
                qualification: outputOperator.qualification,
            }),
            dimensions: Object.freeze({
                evaluationCount: evaluations.length,
                channelsPerEvaluation: this.channelCount,
                outputCount,
                branchCount: branches.length,
                branchVectorLength: outputCount,
            }),
            outputs,
            branches,
            comparisons,
        });
    }

    /**
     * Validate fixed LIME dimensions before building large operators.
     *
     * @returns {void}
     */
    _validateDimensions() {
        if (this.wavelengthCount !== 2151) {
            throw new Error('LIME ASD wavelength count must equal 2151.');
        }
        if (this.phaseCount !== 180) {
            throw new Error('LIME ASD phase count must equal 180.');
        }
        if (this.anchorCount !== 6) {
            throw new Error('LIME coefficient anchor count must equal 6.');
        }
        if (this.coefficientCount !== 108) {
            throw new Error('LIME coefficient variable count must equal 108.');
        }
        if (this.channelCount !== 15) {
            throw new Error('LIME canonical channel count must equal 15.');
        }
    }

    /**
     * Build exact TSIS-weighted output transforms on the retained ASD grid.
     *
     * @returns {Readonly<Record<string, unknown>>} Irradiance and effective-reflectance operators.
     */
    _buildTsisReferenceOutputOperators() {
        const tsisValues = Float64Array.from(this.asdWavelengths, (wavelength) =>
            this.model._interpolateLinearSample(
                this.model.tsisReference.wavelengthsNanometers,
                this.model.tsisReference.values,
                wavelength,
            ));
        const referenceSolidAngleOverPi =
            LIME_REFERENCE_MOON_SOLID_ANGLE_STERADIANS / Math.PI;
        const irradiance = this.createOutputOperator({
            id: 'tsis-reference-disk-irradiance-density',
            quantity: 'spectral-irradiance-density',
            units: 'W m^-2 nm^-1',
            spectralWeights: tsisValues,
            channelScales: new Float64Array(this.channelCount).fill(
                referenceSolidAngleOverPi,
            ),
            qualification:
                'Exact bin average of reconstructed reflectance times the retained TSIS reference, scaled by the LIME reference Moon solid angle over pi; distance factor equals one.',
        });
        const canonicalSolar = this.model.canonicalSolar?.values;
        if (!Array.isArray(canonicalSolar) || canonicalSolar.length !== this.channelCount) {
            throw new Error('LIME TSIS output transform requires canonical solar values.');
        }
        const effectiveReflectance = this.createOutputOperator({
            id: 'canonical-sun-equivalent-tsis-weighted-reflectance',
            quantity: 'dimensionless-disk-equivalent-reflectance',
            units: '1',
            spectralWeights: tsisValues,
            channelScales: Float64Array.from(
                canonicalSolar,
                (value) => 1 / value,
            ),
            qualification:
                'TSIS-weighted reference irradiance divided channel-wise by canonical-Sun irradiance density times the same reference solid-angle-over-pi factor.',
        });
        return Object.freeze({
            referenceMoonSolidAngleSteradians:
                LIME_REFERENCE_MOON_SOLID_ANGLE_STERADIANS,
            referenceSolidAngleOverPi,
            tsisValuesOnAsdGrid: tsisValues,
            irradiance,
            canonicalSunEquivalentReflectance: effectiveReflectance,
        });
    }

    /**
     * Resolve one built-in, reusable, or configured output operator.
     *
     * @param {string | Readonly<Record<string, unknown>> | null} outputTransform - Requested output transform.
     * @returns {Readonly<Record<string, unknown>>} Validated output operator.
     */
    _resolveOutputOperator(outputTransform) {
        if (outputTransform === null || outputTransform === 'reflectance') {
            return this.reflectanceOutputOperator;
        }
        if (outputTransform === 'tsis-reference-irradiance') {
            return this.tsisReferenceOutputOperators.irradiance;
        }
        if (outputTransform === 'canonical-sun-equivalent-reflectance') {
            return this.tsisReferenceOutputOperators.canonicalSunEquivalentReflectance;
        }
        if (outputTransform && typeof outputTransform === 'object') {
            if (outputTransform.values) {
                const values = toFlatFloat64(
                    outputTransform.values,
                    'LIME output operator',
                );
                if (
                    values.length !== this.channelCount * this.wavelengthCount
                    || values.some((value) => !Number.isFinite(value))
                ) {
                    throw new Error('LIME output operator has invalid values or shape.');
                }
                return Object.freeze({
                    id: outputTransform.id ?? 'custom-output-operator',
                    quantity: outputTransform.quantity ?? 'unspecified',
                    units: outputTransform.units ?? 'unspecified',
                    qualification: outputTransform.qualification ?? '',
                    shape: Object.freeze([this.channelCount, this.wavelengthCount]),
                    values,
                    diagnostics: summarizeWeightedOperatorRows(
                        values,
                        this.channelCount,
                        this.wavelengthCount,
                    ),
                });
            }
            return this.createOutputOperator(outputTransform);
        }
        throw new Error('Unknown LIME output transform ' + outputTransform + '.');
    }

    /**
     * Convert requests to model evaluations while preserving caller order.
     *
     * @param {readonly unknown[] | Readonly<Record<string, unknown>>} input - Supported propagation input.
     * @returns {readonly Readonly<Record<string, unknown>>[]} Model evaluations.
     */
    _normalizeEvaluations(input) {
        let items = input;
        if (!Array.isArray(items) && items && typeof items === 'object') {
            items = items.evaluations ?? items.requests;
        }
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('LIME uncertainty propagation requires a nonempty ordered list.');
        }
        const evaluations = items.map((item) => {
            if (
                item
                && typeof item === 'object'
                && item.request
                && item.anchorEvaluation
                && item.asd
            ) {
                return item;
            }
            return this.model.evaluate(item);
        });
        const ids = new Set();
        for (const evaluation of evaluations) {
            const id = evaluation.request?.id;
            if (typeof id !== 'string' || id.length === 0 || ids.has(id)) {
                throw new Error('LIME uncertainty requests require unique nonempty string ids.');
            }
            ids.add(id);
            if (
                !Number.isInteger(evaluation.asd.phaseIndex)
                || evaluation.asd.phaseIndex < 0
                || evaluation.asd.phaseIndex >= this.phaseCount
            ) {
                throw new Error('LIME uncertainty evaluation has an invalid ASD phase index.');
            }
        }
        return Object.freeze(evaluations);
    }

    /**
     * Build exact point-sampling rows at the six coefficient anchors.
     *
     * @returns {Float64Array} Six-by-wavelength point operator.
     */
    _buildPointOperator() {
        const operator = new Float64Array(this.anchorCount * this.wavelengthCount);
        for (let row = 0; row < this.anchorCount; row += 1) {
            const index = exactIndexOf(this.asdWavelengths, this.anchorWavelengths[row]);
            if (index === -1) {
                throw new Error(
                    'LIME ASD grid does not contain anchor '
                    + this.anchorWavelengths[row] + ' nm.',
                );
            }
            operator[row * this.wavelengthCount + index] = 1;
        }
        return operator;
    }

    /**
     * Build normalized CIMEL response-integration rows on the ASD grid.
     *
     * @returns {Float64Array} Six-by-wavelength response operator.
     */
    _buildSrfOperator() {
        const operator = new Float64Array(this.anchorCount * this.wavelengthCount);
        for (let row = 0; row < this.anchorCount; row += 1) {
            const wavelength = this.anchorWavelengths[row];
            const response = this.model.cimelResponses[wavelength];
            if (!Array.isArray(response) || response.length < 2) {
                throw new Error('LIME CIMEL response is missing at ' + wavelength + ' nm.');
            }
            let denominator = 0;
            const offset = row * this.wavelengthCount;
            for (let index = 0; index < response.length - 1; index += 1) {
                const left = response[index];
                const right = response[index + 1];
                const width = right.wavelengthNanometers - left.wavelengthNanometers;
                if (!(width > 0)) {
                    throw new Error('LIME CIMEL response wavelengths must increase.');
                }
                const leftScale = left.response * width / 2;
                const rightScale = right.response * width / 2;
                addLinearSampleWeights(
                    operator,
                    offset,
                    this.asdWavelengths,
                    left.wavelengthNanometers,
                    leftScale,
                );
                addLinearSampleWeights(
                    operator,
                    offset,
                    this.asdWavelengths,
                    right.wavelengthNanometers,
                    rightScale,
                );
                denominator += leftScale + rightScale;
            }
            if (!Number.isFinite(denominator) || Math.abs(denominator) <= 1e-15) {
                throw new Error('LIME CIMEL response integral is zero or nonfinite.');
            }
            for (let column = 0; column < this.wavelengthCount; column += 1) {
                operator[offset + column] /= denominator;
            }
        }
        return operator;
    }

    /**
     * Build exact piecewise-linear canonical bin-average rows.
     *
     * @returns {Float64Array} Fifteen-by-wavelength binning operator.
     */
    _buildBinOperator() {
        const operator = new Float64Array(this.channelCount * this.wavelengthCount);
        for (let row = 0; row < this.channelCount; row += 1) {
            const channel = this.basis.channels[row];
            addPiecewiseLinearIntervalAverageWeights(
                operator,
                row * this.wavelengthCount,
                this.asdWavelengths,
                channel.lowerBoundNanometers,
                channel.upperBoundNanometers,
            );
        }
        return operator;
    }

    /**
     * Build SciPy-compatible interpolating B-spline weights with constant tails.
     *
     * @param {number} degree - Spline degree 1, 2, or 3.
     * @param {string} id - Stable method identifier.
     * @returns {Readonly<Record<string, unknown>>} Wavelength-by-anchor interpolation operator.
     */
    _buildInterpolationOperator(degree, id) {
        const knots = buildNotAKnotKnots(this.anchorWavelengths, degree);
        const collocation = new Float64Array(this.anchorCount * this.anchorCount);
        for (let row = 0; row < this.anchorCount; row += 1) {
            const basisValues = evaluateBSplineBasis(
                knots,
                degree,
                this.anchorWavelengths[row],
            );
            collocation.set(basisValues, row * this.anchorCount);
        }
        const inverse = invertSquareMatrix(collocation, this.anchorCount);
        const values = new Float64Array(this.wavelengthCount * this.anchorCount);
        for (let row = 0; row < this.wavelengthCount; row += 1) {
            const wavelength = this.asdWavelengths[row];
            const exactAnchor = exactIndexOf(this.anchorWavelengths, wavelength);
            if (exactAnchor !== -1) {
                values[row * this.anchorCount + exactAnchor] = 1;
                continue;
            }
            if (wavelength < this.anchorWavelengths[0]) {
                values[row * this.anchorCount] = 1;
                continue;
            }
            if (wavelength > this.anchorWavelengths.at(-1)) {
                values[row * this.anchorCount + this.anchorCount - 1] = 1;
                continue;
            }
            const splineBasis = evaluateBSplineBasis(knots, degree, wavelength);
            for (let column = 0; column < this.anchorCount; column += 1) {
                let weight = 0;
                for (let coefficient = 0; coefficient < this.anchorCount; coefficient += 1) {
                    weight += splineBasis[coefficient]
                        * inverse[coefficient * this.anchorCount + column];
                }
                values[row * this.anchorCount + column] = weight;
            }
        }
        const diagnostics = summarizeOperatorRows(
            values,
            this.wavelengthCount,
            this.anchorCount,
        );
        return Object.freeze({
            id,
            degree,
            boundaryCondition: degree === 1
                ? 'piecewise-linear'
                : 'scipy-compatible-not-a-knot',
            tailPolicy: 'constant first/last anchor residual outside 440..1640 nm',
            knots: freezeVector(knots),
            values,
            diagnostics,
        });
    }

    /**
     * Build one branch and both analytic sensitivity matrices.
     *
     * @param {Readonly<Record<string, unknown>>} evaluation - Completed LIME evaluation.
     * @param {Float64Array} interpolation - Wavelength-by-anchor residual weights.
     * @param {Float64Array} srfCorrection - Six-by-wavelength signed SRF operator.
     * @param {Float64Array} outputOperator - Fifteen-by-wavelength output operator.
     * @param {string} srfSign - Branch sign identifier.
     * @param {string} interpolationId - Branch interpolation identifier.
     * @returns {Readonly<Record<string, unknown>>} Branch values and Jacobians.
     */
    _buildBranchState(
        evaluation,
        interpolation,
        srfCorrection,
        outputOperator,
        srfSign,
        interpolationId,
    ) {
        const rawAnchors = Float64Array.from(
            evaluation.anchorEvaluation.anchors,
            (anchor) => anchor.reflectance,
        );
        const asd = Float64Array.from(evaluation.asd.reflectance);
        const scalarState = this._evaluateBranchValues(
            rawAnchors,
            asd,
            interpolation,
            srfCorrection,
            outputOperator,
        );
        const bDiagHW = new Float64Array(this.channelCount * this.anchorCount);
        for (let channel = 0; channel < this.channelCount; channel += 1) {
            const bOffset = channel * this.wavelengthCount;
            const outputOffset = channel * this.anchorCount;
            for (let wavelength = 0; wavelength < this.wavelengthCount; wavelength += 1) {
                const scaledBinWeight = outputOperator[bOffset + wavelength]
                    * asd[wavelength];
                if (scaledBinWeight === 0) {
                    continue;
                }
                const interpolationOffset = wavelength * this.anchorCount;
                for (let anchor = 0; anchor < this.anchorCount; anchor += 1) {
                    bDiagHW[outputOffset + anchor] += scaledBinWeight
                        * interpolation[interpolationOffset + anchor];
                }
            }
        }

        const anchorSensitivity = new Float64Array(
            this.channelCount * this.anchorCount,
        );
        for (let channel = 0; channel < this.channelCount; channel += 1) {
            for (let anchor = 0; anchor < this.anchorCount; anchor += 1) {
                anchorSensitivity[channel * this.anchorCount + anchor] =
                    bDiagHW[channel * this.anchorCount + anchor]
                    / scalarState.pointAnchors[anchor];
            }
        }

        const asdSensitivity = new Float64Array(
            this.channelCount * this.wavelengthCount,
        );
        for (let channel = 0; channel < this.channelCount; channel += 1) {
            const outputOffset = channel * this.wavelengthCount;
            const binOffset = channel * this.wavelengthCount;
            for (let wavelength = 0; wavelength < this.wavelengthCount; wavelength += 1) {
                asdSensitivity[outputOffset + wavelength] =
                    outputOperator[binOffset + wavelength]
                    * scalarState.residualSpectrum[wavelength];
            }
            for (let anchor = 0; anchor < this.anchorCount; anchor += 1) {
                const multiplier = bDiagHW[channel * this.anchorCount + anchor];
                if (multiplier === 0) {
                    continue;
                }
                const point = scalarState.pointAnchors[anchor];
                const corrected = scalarState.correctedAnchors[anchor];
                const correctionOffset = anchor * this.wavelengthCount;
                for (let wavelength = 0; wavelength < this.wavelengthCount; wavelength += 1) {
                    const ratioDerivative =
                        srfCorrection[correctionOffset + wavelength] / point
                        - corrected / (point * point)
                            * this.pointOperator[correctionOffset + wavelength];
                    asdSensitivity[outputOffset + wavelength] +=
                        multiplier * ratioDerivative;
                }
            }
        }
        return Object.freeze({
            requestId: evaluation.request.id,
            srfSign,
            interpolationId,
            rawAnchors,
            asd,
            ...scalarState,
            anchorSensitivity,
            asdSensitivity,
        });
    }

    /**
     * Evaluate a branch without constructing its Jacobians.
     *
     * @param {Float64Array} rawAnchors - Six raw coefficient-model anchors.
     * @param {Float64Array} asd - One 2151-sample ASD phase spectrum.
     * @param {Float64Array} interpolation - Wavelength-by-anchor interpolation weights.
     * @param {Float64Array} srfCorrection - Six-by-wavelength signed SRF operator.
     * @param {Float64Array} outputOperator - Fifteen-by-wavelength output operator.
     * @returns {Readonly<Record<string, unknown>>} Branch intermediate values and canonical output.
     */
    _evaluateBranchValues(
        rawAnchors,
        asd,
        interpolation,
        srfCorrection,
        outputOperator,
    ) {
        const pointAnchors = multiplyMatrixVector(
            this.pointOperator,
            this.anchorCount,
            this.wavelengthCount,
            asd,
        );
        const signedCorrection = multiplyMatrixVector(
            srfCorrection,
            this.anchorCount,
            this.wavelengthCount,
            asd,
        );
        const correctedAnchors = Float64Array.from(
            rawAnchors,
            (value, index) => value + signedCorrection[index],
        );
        const residualAnchors = Float64Array.from(
            correctedAnchors,
            (value, index) => value / pointAnchors[index],
        );
        if (
            pointAnchors.some((value) => !Number.isFinite(value) || value <= 0)
            || correctedAnchors.some((value) => !Number.isFinite(value) || value <= 0)
            || residualAnchors.some((value) => !Number.isFinite(value) || value <= 0)
        ) {
            throw new Error('LIME branch produced an invalid anchor or residual ratio.');
        }
        const residualSpectrum = multiplyMatrixVector(
            interpolation,
            this.wavelengthCount,
            this.anchorCount,
            residualAnchors,
        );
        const hyperspectralReflectance = Float64Array.from(
            asd,
            (value, index) => value * residualSpectrum[index],
        );
        const z = multiplyMatrixVector(
            outputOperator,
            this.channelCount,
            this.wavelengthCount,
            hyperspectralReflectance,
        );
        return Object.freeze({
            pointAnchors,
            signedCorrection,
            correctedAnchors,
            residualAnchors,
            residualSpectrum,
            hyperspectralReflectance,
            z,
        });
    }

    /**
     * Stack output sensitivity to standardized coefficient variables.
     *
     * @param {readonly Readonly<Record<string, unknown>>[]} evaluations - Ordered model evaluations.
     * @param {readonly Readonly<Record<string, unknown>>[]} states - Matching central branch states.
     * @returns {Float64Array} Output-by-coefficient standardized sensitivity.
     */
    _buildCoefficientSensitivity(evaluations, states) {
        const outputCount = evaluations.length * this.channelCount;
        const sensitivity = new Float64Array(outputCount * this.coefficientCount);
        for (let evaluationIndex = 0; evaluationIndex < evaluations.length; evaluationIndex += 1) {
            const evaluation = evaluations[evaluationIndex];
            const state = states[evaluationIndex];
            const anchorJacobian = new Float64Array(
                this.anchorCount * this.coefficientCount,
            );
            for (let anchor = 0; anchor < this.anchorCount; anchor += 1) {
                const gradient = this.model._anchorGradient(
                    evaluation.request.geometry,
                    anchor,
                    RELEASE_INTERPRETATION,
                    state.rawAnchors[anchor],
                );
                anchorJacobian.set(gradient, anchor * this.coefficientCount);
            }
            for (let channel = 0; channel < this.channelCount; channel += 1) {
                const output = evaluationIndex * this.channelCount + channel;
                for (let coefficient = 0; coefficient < this.coefficientCount; coefficient += 1) {
                    let derivative = 0;
                    for (let anchor = 0; anchor < this.anchorCount; anchor += 1) {
                        derivative += state.anchorSensitivity[
                            channel * this.anchorCount + anchor
                        ] * anchorJacobian[anchor * this.coefficientCount + coefficient];
                    }
                    sensitivity[output * this.coefficientCount + coefficient] =
                        derivative * this.coefficientStandardUncertainties[coefficient];
                }
            }
        }
        return sensitivity;
    }

    /**
     * Stack output sensitivity to standardized ASD wavelength variables.
     *
     * @param {readonly Readonly<Record<string, unknown>>[]} evaluations - Ordered model evaluations.
     * @param {readonly Readonly<Record<string, unknown>>[]} states - Matching central branch states.
     * @returns {Float64Array} Output-by-wavelength standardized sensitivity.
     */
    _buildAsdSensitivity(evaluations, states) {
        const outputCount = evaluations.length * this.channelCount;
        const sensitivity = new Float64Array(outputCount * this.wavelengthCount);
        for (let evaluationIndex = 0; evaluationIndex < evaluations.length; evaluationIndex += 1) {
            const state = states[evaluationIndex];
            const relativeUncertainty = evaluations[evaluationIndex]
                .asd.relativeUncertaintyPercent;
            for (let channel = 0; channel < this.channelCount; channel += 1) {
                const sourceOffset = channel * this.wavelengthCount;
                const outputOffset = (
                    evaluationIndex * this.channelCount + channel
                ) * this.wavelengthCount;
                for (let wavelength = 0; wavelength < this.wavelengthCount; wavelength += 1) {
                    const standardUncertainty = state.asd[wavelength]
                        * relativeUncertainty[wavelength] / 100;
                    sensitivity[outputOffset + wavelength] =
                        state.asdSensitivity[sourceOffset + wavelength]
                        * standardUncertainty;
                }
            }
        }
        return sensitivity;
    }

    /**
     * Apply retained phase correlation to every output covariance block.
     *
     * @param {Float64Array} wavelengthCovariance - Covariance before phase correlation.
     * @param {readonly Readonly<Record<string, unknown>>[]} evaluations - Ordered evaluations.
     * @returns {Float64Array} Covariance with wavelength and phase correlation.
     */
    _applyPhaseCorrelation(wavelengthCovariance, evaluations) {
        const outputCount = evaluations.length * this.channelCount;
        const covariance = new Float64Array(wavelengthCovariance.length);
        for (let left = 0; left < outputCount; left += 1) {
            const leftEvaluation = Math.floor(left / this.channelCount);
            const leftPhase = evaluations[leftEvaluation].asd.phaseIndex;
            for (let right = 0; right < outputCount; right += 1) {
                const rightEvaluation = Math.floor(right / this.channelCount);
                const rightPhase = evaluations[rightEvaluation].asd.phaseIndex;
                covariance[left * outputCount + right] =
                    wavelengthCovariance[left * outputCount + right]
                    * this.phaseCorrelation[leftPhase * this.phaseCount + rightPhase];
            }
        }
        return covariance;
    }

    /**
     * Build the global linear/quadratic/cubic interpolation ensemble.
     *
     * @param {readonly Readonly<Record<string, unknown>>[]} evaluations - Ordered model evaluations.
     * @param {Float64Array} outputOperator - Fifteen-by-wavelength output operator.
     * @returns {Readonly<Record<string, unknown>>} Branches, mean, and population covariance.
     */
    _buildInterpolationEnsemble(evaluations, outputOperator) {
        const methods = [
            this.interpolationOperators.linear,
            this.interpolationOperators.quadraticNotAKnot,
            this.interpolationOperators.cubicNotAKnot,
        ];
        const branches = methods.map((method) => concatenateVectors(
            evaluations.map((evaluation) => this._buildBranchState(
                evaluation,
                method.values,
                this.releaseSrfOperator,
                outputOperator,
                RELEASE_SRF_SIGN,
                method.id,
            ).z),
        ));
        return populationCovariance(branches);
    }

    /**
     * Build the global release/ATBD SRF-sign ensemble with interpolation fixed.
     *
     * @param {readonly Readonly<Record<string, unknown>>[]} evaluations - Ordered model evaluations.
     * @param {Float64Array} outputOperator - Fifteen-by-wavelength output operator.
     * @returns {Readonly<Record<string, unknown>>} Branches, mean, and population covariance.
     */
    _buildSrfSignEnsemble(evaluations, outputOperator) {
        const branches = [
            [this.releaseSrfOperator, RELEASE_SRF_SIGN],
            [this.atbdSrfOperator, ATBD_SRF_SIGN],
        ].map(([operator, sign]) => concatenateVectors(
            evaluations.map((evaluation) => this._buildBranchState(
                evaluation,
                this.interpolationOperators.linear.values,
                operator,
                outputOperator,
                sign,
                'linear',
            ).z),
        ));
        return populationCovariance(branches);
    }

    /**
     * Compare the analytic branch Jacobians with centered finite differences.
     *
     * @param {Readonly<Record<string, unknown>>} evaluation - Completed model evaluation.
     * @param {Readonly<Record<string, unknown>>} state - Matching central branch state.
     * @param {Float64Array} outputOperator - Fifteen-by-wavelength output operator.
     * @returns {Readonly<Record<string, unknown>>} Anchor and ASD sensitivity checks.
     */
    _checkJacobiansForState(evaluation, state, outputOperator) {
        const anchorAccumulator = createDerivativeErrorAccumulator();
        for (let anchor = 0; anchor < this.anchorCount; anchor += 1) {
            const step = finiteDifferenceStep(state.rawAnchors[anchor]);
            const plus = Float64Array.from(state.rawAnchors);
            const minus = Float64Array.from(state.rawAnchors);
            plus[anchor] += step;
            minus[anchor] -= step;
            const plusValues = this._evaluateBranchValues(
                plus,
                state.asd,
                this.interpolationOperators.linear.values,
                this.releaseSrfOperator,
                outputOperator,
            ).z;
            const minusValues = this._evaluateBranchValues(
                minus,
                state.asd,
                this.interpolationOperators.linear.values,
                this.releaseSrfOperator,
                outputOperator,
            ).z;
            for (let channel = 0; channel < this.channelCount; channel += 1) {
                const numerical = (plusValues[channel] - minusValues[channel])
                    / (2 * step);
                const analytic = state.anchorSensitivity[
                    channel * this.anchorCount + anchor
                ];
                accumulateDerivativeError(anchorAccumulator, analytic, numerical);
            }
        }

        const asdAccumulator = createDerivativeErrorAccumulator();
        const sampleIndices = this._jacobianAsdSampleIndices();
        for (const wavelength of sampleIndices) {
            const step = finiteDifferenceStep(state.asd[wavelength]);
            const plus = Float64Array.from(state.asd);
            const minus = Float64Array.from(state.asd);
            plus[wavelength] += step;
            minus[wavelength] -= step;
            const plusValues = this._evaluateBranchValues(
                state.rawAnchors,
                plus,
                this.interpolationOperators.linear.values,
                this.releaseSrfOperator,
                outputOperator,
            ).z;
            const minusValues = this._evaluateBranchValues(
                state.rawAnchors,
                minus,
                this.interpolationOperators.linear.values,
                this.releaseSrfOperator,
                outputOperator,
            ).z;
            for (let channel = 0; channel < this.channelCount; channel += 1) {
                const numerical = (plusValues[channel] - minusValues[channel])
                    / (2 * step);
                const analytic = state.asdSensitivity[
                    channel * this.wavelengthCount + wavelength
                ];
                accumulateDerivativeError(asdAccumulator, analytic, numerical);
            }
        }
        return Object.freeze({
            requestId: evaluation.request.id,
            finiteDifference: 'centered, adaptive 1e-5 relative step with 1e-8 floor',
            tolerance: JACOBIAN_TOLERANCE,
            anchorSensitivity: finishDerivativeErrorAccumulator(anchorAccumulator),
            asdSensitivity: Object.freeze({
                ...finishDerivativeErrorAccumulator(asdAccumulator),
                sampledWavelengthIndices: Object.freeze([...sampleIndices]),
                sampledWavelengthsNanometers: Object.freeze(sampleIndices.map(
                    (index) => this.asdWavelengths[index],
                )),
            }),
        });
    }

    /**
     * Choose deterministic ASD columns that cover bins, anchors, and response peaks.
     *
     * @returns {readonly number[]} Sorted ASD sample indices.
     */
    _jacobianAsdSampleIndices() {
        const indices = new Set();
        for (const wavelength of this.anchorWavelengths) {
            indices.add(exactIndexOf(this.asdWavelengths, wavelength));
        }
        for (const channel of this.basis.channels) {
            indices.add(nearestIndex(this.asdWavelengths, channel.centerNanometers));
        }
        for (const wavelength of this.anchorWavelengths) {
            const response = this.model.cimelResponses[wavelength];
            const peak = response.reduce((best, sample) =>
                Math.abs(sample.response) > Math.abs(best.response) ? sample : best);
            indices.add(nearestIndex(this.asdWavelengths, peak.wavelengthNanometers));
        }
        return Object.freeze([...indices].filter((index) => index >= 0).sort(
            (left, right) => left - right,
        ));
    }

    /**
     * Compare the reconstructed release-linear branch with the model evaluation.
     *
     * @param {Readonly<Record<string, unknown>>} evaluation - Completed model evaluation.
     * @param {Readonly<Record<string, unknown>>} state - Reconstructed central branch state.
     * @param {Readonly<Record<string, unknown>>} outputOperator - Active output operator.
     * @returns {Readonly<Record<string, unknown>>} Maximum canonical disagreement.
     */
    _compareCentralPrediction(evaluation, state, outputOperator) {
        if (outputOperator.id !== this.reflectanceOutputOperator.id) {
            return Object.freeze({
                requestId: evaluation.request.id,
                status: 'not-applicable-to-weighted-output',
                outputOperatorId: outputOperator.id,
            });
        }
        const expected = evaluation.interpolation.executableLinear.canonicalChannels
            .map((channel) => channel.value);
        let maximumAbsoluteDifference = 0;
        let maximumRelativeDifference = 0;
        for (let index = 0; index < this.channelCount; index += 1) {
            const difference = Math.abs(state.z[index] - expected[index]);
            maximumAbsoluteDifference = Math.max(maximumAbsoluteDifference, difference);
            maximumRelativeDifference = Math.max(
                maximumRelativeDifference,
                difference / Math.max(Math.abs(expected[index]), Number.MIN_VALUE),
            );
        }
        if (maximumRelativeDifference > 1e-12) {
            throw new Error(
                'LIME uncertainty central branch does not reconstruct the release model: '
                + maximumRelativeDifference + '.',
            );
        }
        return Object.freeze({
            requestId: evaluation.request.id,
            maximumAbsoluteDifference,
            maximumRelativeDifference,
            tolerance: 1e-12,
        });
    }

    /**
     * Validate one retained correlation matrix and summarize its residuals.
     *
     * @param {Float64Array} matrix - Flat square correlation matrix.
     * @param {number} size - Matrix dimension.
     * @param {number} symmetryTolerance - Maximum accepted absolute asymmetry.
     * @param {string} label - Matrix label used in errors.
     * @returns {Readonly<Record<string, unknown>>} Correlation diagnostics.
     */
    _validateCorrelation(matrix, size, symmetryTolerance, label) {
        if (matrix.length !== size * size) {
            throw new Error(label + ' must have shape [' + size + ', ' + size + '].');
        }
        let maximumSymmetryResidual = 0;
        let maximumDiagonalResidual = 0;
        let minimumEntry = Infinity;
        let maximumEntry = -Infinity;
        for (let row = 0; row < size; row += 1) {
            for (let column = 0; column < size; column += 1) {
                const value = matrix[row * size + column];
                if (!Number.isFinite(value)) {
                    throw new Error(label + ' contains a nonfinite entry.');
                }
                minimumEntry = Math.min(minimumEntry, value);
                maximumEntry = Math.max(maximumEntry, value);
                if (row === column) {
                    maximumDiagonalResidual = Math.max(
                        maximumDiagonalResidual,
                        Math.abs(value - 1),
                    );
                } else if (column > row) {
                    maximumSymmetryResidual = Math.max(
                        maximumSymmetryResidual,
                        Math.abs(value - matrix[column * size + row]),
                    );
                }
            }
        }
        if (maximumSymmetryResidual > symmetryTolerance) {
            throw new Error(
                label + ' symmetry residual ' + maximumSymmetryResidual
                + ' exceeds ' + symmetryTolerance + '.',
            );
        }
        if (maximumDiagonalResidual > 1e-12) {
            throw new Error(label + ' diagonal differs from one.');
        }
        return Object.freeze({
            shape: Object.freeze([size, size]),
            maximumSymmetryResidual,
            symmetryTolerance,
            maximumDiagonalResidual,
            minimumEntry,
            maximumEntry,
        });
    }

    /**
     * Validate one output covariance and summarize its numerical range.
     *
     * @param {Float64Array} covariance - Flat output covariance.
     * @param {number} size - Output dimension.
     * @param {string} label - Component label used in errors.
     * @returns {Readonly<Record<string, unknown>>} Covariance diagnostics.
     */
    _validateCovariance(covariance, size, label) {
        let maximumSymmetryResidual = 0;
        let minimumDiagonal = Infinity;
        let maximumDiagonal = -Infinity;
        let maximumAbsoluteEntry = 0;
        for (let row = 0; row < size; row += 1) {
            const diagonal = covariance[row * size + row];
            minimumDiagonal = Math.min(minimumDiagonal, diagonal);
            maximumDiagonal = Math.max(maximumDiagonal, diagonal);
            for (let column = 0; column < size; column += 1) {
                const value = covariance[row * size + column];
                if (!Number.isFinite(value)) {
                    throw new Error('LIME ' + label + ' contains a nonfinite entry.');
                }
                maximumAbsoluteEntry = Math.max(maximumAbsoluteEntry, Math.abs(value));
                if (column > row) {
                    maximumSymmetryResidual = Math.max(
                        maximumSymmetryResidual,
                        Math.abs(value - covariance[column * size + row]),
                    );
                }
            }
        }
        if (maximumSymmetryResidual > COVARIANCE_SYMMETRY_TOLERANCE) {
            throw new Error(
                'LIME ' + label + ' symmetry residual exceeds '
                + COVARIANCE_SYMMETRY_TOLERANCE + '.',
            );
        }
        if (minimumDiagonal < -COVARIANCE_SYMMETRY_TOLERANCE) {
            throw new Error('LIME ' + label + ' has a materially negative variance.');
        }
        return Object.freeze({
            shape: Object.freeze([size, size]),
            maximumSymmetryResidual,
            symmetryTolerance: COVARIANCE_SYMMETRY_TOLERANCE,
            minimumDiagonal,
            maximumDiagonal,
            maximumAbsoluteEntry,
        });
    }

    /**
     * Describe fixed linear operators without serializing their dense values.
     *
     * @param {Readonly<Record<string, unknown>>} outputOperator - Active weighted output operator.
     * @returns {Readonly<Record<string, unknown>>} Operator shapes and row-sum diagnostics.
     */
    _describeOperators(outputOperator) {
        return Object.freeze({
            pointSampling: Object.freeze({
                shape: Object.freeze([this.anchorCount, this.wavelengthCount]),
                ...summarizeOperatorRows(
                    this.pointOperator,
                    this.anchorCount,
                    this.wavelengthCount,
                ),
            }),
            cimelSrfIntegration: Object.freeze({
                shape: Object.freeze([this.anchorCount, this.wavelengthCount]),
                ...summarizeOperatorRows(
                    this.srfOperator,
                    this.anchorCount,
                    this.wavelengthCount,
                ),
            }),
            canonicalBinAverage: Object.freeze({
                shape: Object.freeze([this.channelCount, this.wavelengthCount]),
                ...summarizeOperatorRows(
                    this.binOperator,
                    this.channelCount,
                    this.wavelengthCount,
                ),
            }),
            activeOutput: Object.freeze({
                id: outputOperator.id,
                quantity: outputOperator.quantity,
                units: outputOperator.units,
                qualification: outputOperator.qualification,
                shape: outputOperator.shape,
                ...outputOperator.diagnostics,
            }),
            residualInterpolation: Object.freeze(Object.fromEntries(
                Object.entries(this.interpolationOperators).map(([key, operator]) => [
                    key,
                    Object.freeze({
                        shape: Object.freeze([
                            this.wavelengthCount,
                            this.anchorCount,
                        ]),
                        degree: operator.degree,
                        boundaryCondition: operator.boundaryCondition,
                        tailPolicy: operator.tailPolicy,
                        knots: operator.knots,
                        ...operator.diagnostics,
                    }),
                ]),
            )),
        });
    }
}

/**
 * Convert a flat or nested numeric matrix to contiguous Float64 storage.
 *
 * @param {unknown} value - Numeric array or typed array.
 * @param {string} label - Value label used in errors.
 * @returns {Float64Array} Flat numeric values.
 */
function toFlatFloat64(value, label) {
    if (ArrayBuffer.isView(value)) {
        return Float64Array.from(value);
    }
    if (Array.isArray(value)) {
        if (value.length > 0 && (Array.isArray(value[0]) || ArrayBuffer.isView(value[0]))) {
            return Float64Array.from(value.flatMap((row) => Array.from(row)));
        }
        return Float64Array.from(value);
    }
    throw new Error(label + ' does not expose numeric values.');
}

/**
 * Find an exact value in one short ordered numeric sequence.
 *
 * @param {ArrayLike<number>} values - Ordered values.
 * @param {number} target - Exact target.
 * @returns {number} Matching index or -1.
 */
function exactIndexOf(values, target) {
    for (let index = 0; index < values.length; index += 1) {
        if (values[index] === target) {
            return index;
        }
    }
    return -1;
}

/**
 * Find the nearest value in one ordered numeric sequence.
 *
 * @param {ArrayLike<number>} values - Ordered values.
 * @param {number} target - Requested value.
 * @returns {number} Nearest index.
 */
function nearestIndex(values, target) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let index = 0; index < values.length; index += 1) {
        const distance = Math.abs(values[index] - target);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
        }
    }
    return bestIndex;
}

/**
 * Add one linear point-sample functional to an operator row.
 *
 * @param {Float64Array} output - Destination matrix.
 * @param {number} offset - Destination row offset.
 * @param {ArrayLike<number>} wavelengths - Ordered source wavelengths.
 * @param {number} wavelength - Sample wavelength.
 * @param {number} scale - Functional scale.
 * @returns {void}
 */
function addLinearSampleWeights(output, offset, wavelengths, wavelength, scale) {
    if (wavelength < wavelengths[0] || wavelength > wavelengths[wavelengths.length - 1]) {
        throw new Error('LIME response requests a wavelength outside ASD support.');
    }
    let low = 0;
    let high = wavelengths.length - 1;
    while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (wavelengths[middle] <= wavelength) {
            low = middle;
        } else {
            high = middle;
        }
    }
    if (wavelength === wavelengths[low]) {
        output[offset + low] += scale;
        return;
    }
    if (wavelength === wavelengths[high]) {
        output[offset + high] += scale;
        return;
    }
    const fraction = (wavelength - wavelengths[low])
        / (wavelengths[high] - wavelengths[low]);
    output[offset + low] += scale * (1 - fraction);
    output[offset + high] += scale * fraction;
}

/**
 * Add exact interval-average weights for a piecewise-linear sample set.
 *
 * @param {Float64Array} output - Destination matrix.
 * @param {number} offset - Destination row offset.
 * @param {ArrayLike<number>} wavelengths - Ordered source wavelengths.
 * @param {number} lower - Interval lower bound.
 * @param {number} upper - Interval upper bound.
 * @returns {void}
 */
function addPiecewiseLinearIntervalAverageWeights(
    output,
    offset,
    wavelengths,
    lower,
    upper,
) {
    if (
        !(lower < upper)
        || lower < wavelengths[0]
        || upper > wavelengths[wavelengths.length - 1]
    ) {
        throw new Error('LIME canonical bin lies outside ASD support.');
    }
    const intervalWidth = upper - lower;
    for (let index = 0; index < wavelengths.length - 1; index += 1) {
        const x0 = wavelengths[index];
        const x1 = wavelengths[index + 1];
        const a = Math.max(lower, x0);
        const b = Math.min(upper, x1);
        if (b <= a) {
            continue;
        }
        const segmentWidth = x1 - x0;
        const firstMoment = (b * b - a * a) / 2;
        output[offset + index] += (
            x1 * (b - a) - firstMoment
        ) / segmentWidth / intervalWidth;
        output[offset + index + 1] += (
            firstMoment - x0 * (b - a)
        ) / segmentWidth / intervalWidth;
    }
}

/**
 * Build the SciPy not-a-knot knot sequence for one interpolation degree.
 *
 * @param {ArrayLike<number>} x - Strictly increasing interpolation sites.
 * @param {number} degree - Degree 1, 2, or 3.
 * @returns {Float64Array} Complete knot sequence.
 */
function buildNotAKnotKnots(x, degree) {
    let interior;
    if (degree === 1) {
        interior = Array.from(x).slice(1, -1);
    } else if (degree === 2) {
        const pairMidpoints = Array.from(
            { length: x.length - 1 },
            (_, index) => (x[index] + x[index + 1]) / 2,
        );
        interior = pairMidpoints.slice(1, -1);
    } else if (degree === 3) {
        interior = Array.from(x).slice(2, -2);
    } else {
        throw new Error('LIME interpolation supports only degrees 1, 2, and 3.');
    }
    return Float64Array.from([
        ...new Array(degree + 1).fill(x[0]),
        ...interior,
        ...new Array(degree + 1).fill(x[x.length - 1]),
    ]);
}

/**
 * Evaluate every B-spline basis function at one in-domain coordinate.
 *
 * @param {ArrayLike<number>} knots - Complete nondecreasing knot sequence.
 * @param {number} degree - Spline degree.
 * @param {number} x - In-domain coordinate.
 * @returns {Float64Array} Basis values.
 */
function evaluateBSplineBasis(knots, degree, x) {
    const basisCount = knots.length - degree - 1;
    const leftDomain = knots[degree];
    const rightDomain = knots[basisCount];
    if (x < leftDomain || x > rightDomain) {
        throw new Error('B-spline evaluation lies outside its interpolation domain.');
    }
    if (x === rightDomain) {
        const endpoint = new Float64Array(basisCount);
        endpoint[basisCount - 1] = 1;
        return endpoint;
    }
    let level = new Float64Array(knots.length - 1);
    for (let index = 0; index < level.length; index += 1) {
        if (knots[index] <= x && x < knots[index + 1]) {
            level[index] = 1;
        }
    }
    for (let order = 1; order <= degree; order += 1) {
        const next = new Float64Array(level.length - 1);
        for (let index = 0; index < next.length; index += 1) {
            const leftDenominator = knots[index + order] - knots[index];
            const rightDenominator = knots[index + order + 1] - knots[index + 1];
            if (leftDenominator !== 0) {
                next[index] += (x - knots[index]) / leftDenominator * level[index];
            }
            if (rightDenominator !== 0) {
                next[index] += (knots[index + order + 1] - x)
                    / rightDenominator * level[index + 1];
            }
        }
        level = next;
    }
    return level.slice(0, basisCount);
}

/**
 * Invert one small square matrix with pivoted Gauss-Jordan elimination.
 *
 * @param {Float64Array} matrix - Flat square matrix.
 * @param {number} size - Matrix dimension.
 * @returns {Float64Array} Matrix inverse.
 */
function invertSquareMatrix(matrix, size) {
    const stride = size * 2;
    const augmented = new Float64Array(size * stride);
    for (let row = 0; row < size; row += 1) {
        for (let column = 0; column < size; column += 1) {
            augmented[row * stride + column] = matrix[row * size + column];
        }
        augmented[row * stride + size + row] = 1;
    }
    for (let pivotColumn = 0; pivotColumn < size; pivotColumn += 1) {
        let pivotRow = pivotColumn;
        let pivotMagnitude = Math.abs(augmented[pivotRow * stride + pivotColumn]);
        for (let row = pivotColumn + 1; row < size; row += 1) {
            const magnitude = Math.abs(augmented[row * stride + pivotColumn]);
            if (magnitude > pivotMagnitude) {
                pivotMagnitude = magnitude;
                pivotRow = row;
            }
        }
        if (pivotMagnitude <= 1e-14) {
            throw new Error('LIME spline collocation matrix is singular.');
        }
        if (pivotRow !== pivotColumn) {
            for (let column = 0; column < stride; column += 1) {
                const temporary = augmented[pivotColumn * stride + column];
                augmented[pivotColumn * stride + column] =
                    augmented[pivotRow * stride + column];
                augmented[pivotRow * stride + column] = temporary;
            }
        }
        const pivot = augmented[pivotColumn * stride + pivotColumn];
        for (let column = 0; column < stride; column += 1) {
            augmented[pivotColumn * stride + column] /= pivot;
        }
        for (let row = 0; row < size; row += 1) {
            if (row === pivotColumn) {
                continue;
            }
            const factor = augmented[row * stride + pivotColumn];
            if (factor === 0) {
                continue;
            }
            for (let column = 0; column < stride; column += 1) {
                augmented[row * stride + column] -= factor
                    * augmented[pivotColumn * stride + column];
            }
        }
    }
    const inverse = new Float64Array(size * size);
    for (let row = 0; row < size; row += 1) {
        for (let column = 0; column < size; column += 1) {
            inverse[row * size + column] =
                augmented[row * stride + size + column];
        }
    }
    return inverse;
}

/**
 * Multiply one flat row-major matrix by a vector.
 *
 * @param {Float64Array} matrix - Row-major matrix.
 * @param {number} rows - Matrix row count.
 * @param {number} columns - Matrix column count.
 * @param {ArrayLike<number>} vector - Matching vector.
 * @returns {Float64Array} Matrix-vector product.
 */
function multiplyMatrixVector(matrix, rows, columns, vector) {
    const result = new Float64Array(rows);
    for (let row = 0; row < rows; row += 1) {
        let sum = 0;
        const offset = row * columns;
        for (let column = 0; column < columns; column += 1) {
            sum += matrix[offset + column] * vector[column];
        }
        result[row] = sum;
    }
    return result;
}

/**
 * Replace each off-diagonal pair with its arithmetic mean.
 *
 * @param {Float64Array} matrix - Mutable flat square matrix.
 * @param {number} size - Matrix dimension.
 * @returns {void}
 */
function symmetrizeSquareMatrixInPlace(matrix, size) {
    for (let row = 0; row < size; row += 1) {
        for (let column = 0; column < row; column += 1) {
            const value = (
                matrix[row * size + column]
                + matrix[column * size + row]
            ) / 2;
            matrix[row * size + column] = value;
            matrix[column * size + row] = value;
        }
    }
}

/**
 * Compute X R X-transpose while skipping exactly zero sensitivity entries.
 *
 * @param {Float64Array} sensitivity - Output-by-variable standardized sensitivity.
 * @param {number} outputCount - Output row count.
 * @param {number} variableCount - Correlated variable count.
 * @param {Float64Array} correlation - Variable correlation matrix.
 * @returns {Float64Array} Symmetric output covariance.
 */
function sandwichCorrelation(
    sensitivity,
    outputCount,
    variableCount,
    correlation,
) {
    const transformed = new Float64Array(outputCount * variableCount);
    for (let output = 0; output < outputCount; output += 1) {
        const sensitivityOffset = output * variableCount;
        const transformedOffset = output * variableCount;
        for (let variable = 0; variable < variableCount; variable += 1) {
            const scale = sensitivity[sensitivityOffset + variable];
            if (scale === 0) {
                continue;
            }
            const correlationOffset = variable * variableCount;
            for (let column = 0; column < variableCount; column += 1) {
                transformed[transformedOffset + column] +=
                    scale * correlation[correlationOffset + column];
            }
        }
    }
    const covariance = new Float64Array(outputCount * outputCount);
    for (let left = 0; left < outputCount; left += 1) {
        const transformedOffset = left * variableCount;
        for (let right = 0; right <= left; right += 1) {
            const sensitivityOffset = right * variableCount;
            let value = 0;
            for (let variable = 0; variable < variableCount; variable += 1) {
                value += transformed[transformedOffset + variable]
                    * sensitivity[sensitivityOffset + variable];
            }
            covariance[left * outputCount + right] = value;
            covariance[right * outputCount + left] = value;
        }
    }
    return covariance;
}

/**
 * Build a population covariance across globally stacked branch predictions.
 *
 * @param {readonly Float64Array[]} branches - Equal-length branch vectors.
 * @returns {Readonly<Record<string, unknown>>} Branches, mean, and covariance.
 */
function populationCovariance(branches) {
    if (branches.length < 2 || branches.some((branch) => branch.length !== branches[0].length)) {
        throw new Error('LIME ensemble covariance requires aligned branch vectors.');
    }
    const size = branches[0].length;
    const mean = new Float64Array(size);
    for (const branch of branches) {
        for (let index = 0; index < size; index += 1) {
            mean[index] += branch[index] / branches.length;
        }
    }
    const covariance = new Float64Array(size * size);
    for (const branch of branches) {
        for (let row = 0; row < size; row += 1) {
            const left = branch[row] - mean[row];
            for (let column = 0; column <= row; column += 1) {
                const value = left * (branch[column] - mean[column]) / branches.length;
                covariance[row * size + column] += value;
                if (column !== row) {
                    covariance[column * size + row] += value;
                }
            }
        }
    }
    return Object.freeze({
        branches: Object.freeze(branches),
        mean,
        covariance,
    });
}

/**
 * Subtract two equal-shape matrices.
 *
 * @param {Float64Array} left - Left matrix.
 * @param {Float64Array} right - Right matrix.
 * @returns {Float64Array} Elementwise difference.
 */
function subtractMatrices(left, right) {
    if (left.length !== right.length) {
        throw new Error('Cannot subtract LIME operators with different shapes.');
    }
    return Float64Array.from(left, (value, index) => value - right[index]);
}

/**
 * Scale one flat matrix.
 *
 * @param {Float64Array} matrix - Source matrix.
 * @param {number} scale - Numeric scale.
 * @returns {Float64Array} Scaled matrix.
 */
function scaleMatrix(matrix, scale) {
    return Float64Array.from(matrix, (value) => value * scale);
}

/**
 * Sum aligned flat matrices.
 *
 * @param {readonly Float64Array[]} matrices - Aligned matrices.
 * @returns {Float64Array} Elementwise sum.
 */
function sumMatrices(matrices) {
    if (matrices.length === 0 || matrices.some((matrix) => matrix.length !== matrices[0].length)) {
        throw new Error('Cannot sum unaligned LIME covariance matrices.');
    }
    const result = new Float64Array(matrices[0].length);
    for (const matrix of matrices) {
        for (let index = 0; index < result.length; index += 1) {
            result[index] += matrix[index];
        }
    }
    return result;
}

/**
 * Concatenate numeric vectors without losing Float64 storage.
 *
 * @param {readonly ArrayLike<number>[]} vectors - Ordered vectors.
 * @returns {Float64Array} Concatenated values.
 */
function concatenateVectors(vectors) {
    const length = vectors.reduce((sum, vector) => sum + vector.length, 0);
    const output = new Float64Array(length);
    let offset = 0;
    for (const vector of vectors) {
        output.set(vector, offset);
        offset += vector.length;
    }
    return output;
}

/**
 * Return the largest absolute elementwise matrix difference.
 *
 * @param {Float64Array} left - Left matrix.
 * @param {Float64Array} right - Right matrix.
 * @returns {number} Maximum absolute difference.
 */
function maximumMatrixDifference(left, right) {
    let maximum = 0;
    for (let index = 0; index < left.length; index += 1) {
        maximum = Math.max(maximum, Math.abs(left[index] - right[index]));
    }
    return maximum;
}

/**
 * Compare two aligned authority-branch output vectors.
 *
 * @param {ArrayLike<number>} left - First globally stacked branch.
 * @param {ArrayLike<number>} right - Second globally stacked branch.
 * @returns {Readonly<Record<string, unknown>>} Maximum absolute and symmetric-relative differences.
 */
function compareBranchVectors(left, right) {
    if (left.length !== right.length || left.length === 0) {
        throw new Error('LIME authority branches must expose aligned nonempty vectors.');
    }
    let maximumAbsoluteDifference = 0;
    let maximumAbsoluteDifferenceOutputIndex = 0;
    let maximumRelativeDifference = 0;
    let maximumRelativeDifferenceOutputIndex = 0;
    for (let index = 0; index < left.length; index += 1) {
        const absoluteDifference = Math.abs(left[index] - right[index]);
        const relativeDifference = absoluteDifference / Math.max(
            Math.abs(left[index]),
            Math.abs(right[index]),
            Number.MIN_VALUE,
        );
        if (absoluteDifference > maximumAbsoluteDifference) {
            maximumAbsoluteDifference = absoluteDifference;
            maximumAbsoluteDifferenceOutputIndex = index;
        }
        if (relativeDifference > maximumRelativeDifference) {
            maximumRelativeDifference = relativeDifference;
            maximumRelativeDifferenceOutputIndex = index;
        }
    }
    return Object.freeze({
        maximumAbsoluteDifference,
        maximumAbsoluteDifferenceOutputIndex,
        maximumRelativeDifference,
        maximumRelativeDifferenceOutputIndex,
    });
}

/**
 * Extract nonnegative standard uncertainties from a covariance diagonal.
 *
 * @param {Float64Array} covariance - Flat covariance matrix.
 * @param {number} size - Matrix dimension.
 * @returns {Float64Array} Standard uncertainties.
 */
function diagonalStandardUncertainties(covariance, size) {
    return Float64Array.from(
        { length: size },
        (_, index) => Math.sqrt(Math.max(0, covariance[index * size + index])),
    );
}

/**
 * Convert a covariance matrix to correlation with zero-variance-safe entries.
 *
 * @param {Float64Array} covariance - Flat covariance matrix.
 * @param {number} size - Matrix dimension.
 * @returns {Float64Array} Flat correlation matrix.
 */
function covarianceToCorrelation(covariance, size) {
    const standard = diagonalStandardUncertainties(covariance, size);
    const correlation = new Float64Array(covariance.length);
    for (let row = 0; row < size; row += 1) {
        for (let column = 0; column < size; column += 1) {
            const denominator = standard[row] * standard[column];
            correlation[row * size + column] = denominator === 0
                ? 0
                : covariance[row * size + column] / denominator;
        }
    }
    return correlation;
}

/**
 * Summarize row sums and coefficient ranges for one linear operator.
 *
 * @param {Float64Array} matrix - Flat row-major matrix.
 * @param {number} rows - Row count.
 * @param {number} columns - Column count.
 * @returns {Readonly<Record<string, unknown>>} Operator diagnostics.
 */
function summarizeOperatorRows(matrix, rows, columns) {
    let maximumRowSumResidual = 0;
    let minimumEntry = Infinity;
    let maximumEntry = -Infinity;
    let nonzeroEntryCount = 0;
    for (let row = 0; row < rows; row += 1) {
        let sum = 0;
        for (let column = 0; column < columns; column += 1) {
            const value = matrix[row * columns + column];
            sum += value;
            minimumEntry = Math.min(minimumEntry, value);
            maximumEntry = Math.max(maximumEntry, value);
            if (value !== 0) {
                nonzeroEntryCount += 1;
            }
        }
        maximumRowSumResidual = Math.max(maximumRowSumResidual, Math.abs(sum - 1));
    }
    if (maximumRowSumResidual > 1e-12) {
        throw new Error('LIME linear operator does not preserve constants.');
    }
    return Object.freeze({
        maximumRowSumResidual,
        rowSumTolerance: 1e-12,
        minimumEntry,
        maximumEntry,
        nonzeroEntryCount,
    });
}

/**
 * Summarize a weighted output operator whose rows need not preserve constants.
 *
 * @param {Float64Array} matrix - Flat row-major matrix.
 * @param {number} rows - Row count.
 * @param {number} columns - Column count.
 * @returns {Readonly<Record<string, unknown>>} Weighted-operator diagnostics.
 */
function summarizeWeightedOperatorRows(matrix, rows, columns) {
    let minimumEntry = Infinity;
    let maximumEntry = -Infinity;
    let minimumRowSum = Infinity;
    let maximumRowSum = -Infinity;
    let nonzeroEntryCount = 0;
    for (let row = 0; row < rows; row += 1) {
        let rowSum = 0;
        for (let column = 0; column < columns; column += 1) {
            const value = matrix[row * columns + column];
            rowSum += value;
            minimumEntry = Math.min(minimumEntry, value);
            maximumEntry = Math.max(maximumEntry, value);
            if (value !== 0) {
                nonzeroEntryCount += 1;
            }
        }
        minimumRowSum = Math.min(minimumRowSum, rowSum);
        maximumRowSum = Math.max(maximumRowSum, rowSum);
    }
    return Object.freeze({
        minimumEntry,
        maximumEntry,
        minimumRowSum,
        maximumRowSum,
        nonzeroEntryCount,
    });
}

/**
 * Summarize sensitivity row norms and sparsity.
 *
 * @param {Float64Array} matrix - Flat row-major sensitivity.
 * @param {number} rows - Row count.
 * @param {number} columns - Column count.
 * @returns {Readonly<Record<string, unknown>>} Sensitivity diagnostics.
 */
function summarizeRows(matrix, rows, columns) {
    let minimumL2Norm = Infinity;
    let maximumL2Norm = 0;
    let maximumAbsoluteEntry = 0;
    let nonzeroEntryCount = 0;
    for (let row = 0; row < rows; row += 1) {
        let sumSquares = 0;
        for (let column = 0; column < columns; column += 1) {
            const value = matrix[row * columns + column];
            sumSquares += value * value;
            maximumAbsoluteEntry = Math.max(maximumAbsoluteEntry, Math.abs(value));
            if (value !== 0) {
                nonzeroEntryCount += 1;
            }
        }
        const norm = Math.sqrt(sumSquares);
        minimumL2Norm = Math.min(minimumL2Norm, norm);
        maximumL2Norm = Math.max(maximumL2Norm, norm);
    }
    return Object.freeze({
        shape: Object.freeze([rows, columns]),
        minimumL2Norm,
        maximumL2Norm,
        maximumAbsoluteEntry,
        nonzeroEntryCount,
    });
}

/**
 * Choose a stable centered finite-difference step.
 *
 * @param {number} value - Perturbed value.
 * @returns {number} Positive perturbation magnitude.
 */
function finiteDifferenceStep(value) {
    return Math.max(Math.abs(value) * 1e-5, 1e-8);
}

/**
 * Create a mutable derivative-error accumulator.
 *
 * @returns {Record<string, number>} Empty accumulator.
 */
function createDerivativeErrorAccumulator() {
    return {
        comparisonCount: 0,
        materialComparisonCount: 0,
        maximumAbsoluteError: 0,
        maximumScaledError: 0,
        maximumMaterialRelativeError: 0,
    };
}

/**
 * Add one analytic/numerical derivative pair to an error accumulator.
 *
 * @param {Record<string, number>} accumulator - Mutable accumulator.
 * @param {number} analytic - Analytic derivative.
 * @param {number} numerical - Centered finite-difference derivative.
 * @returns {void}
 */
function accumulateDerivativeError(accumulator, analytic, numerical) {
    const absoluteError = Math.abs(analytic - numerical);
    const magnitude = Math.max(Math.abs(analytic), Math.abs(numerical));
    accumulator.comparisonCount += 1;
    accumulator.maximumAbsoluteError = Math.max(
        accumulator.maximumAbsoluteError,
        absoluteError,
    );
    accumulator.maximumScaledError = Math.max(
        accumulator.maximumScaledError,
        absoluteError / Math.max(1, magnitude),
    );
    if (magnitude >= 1e-8) {
        accumulator.materialComparisonCount += 1;
        accumulator.maximumMaterialRelativeError = Math.max(
            accumulator.maximumMaterialRelativeError,
            absoluteError / magnitude,
        );
    }
}

/**
 * Freeze one derivative-error summary.
 *
 * @param {Record<string, number>} accumulator - Completed accumulator.
 * @returns {Readonly<Record<string, unknown>>} Frozen summary.
 */
function finishDerivativeErrorAccumulator(accumulator) {
    return Object.freeze({
        ...accumulator,
        passed: accumulator.maximumScaledError <= JACOBIAN_TOLERANCE,
    });
}

/**
 * Freeze one vector as a JSON-compatible numeric array.
 *
 * @param {ArrayLike<number>} vector - Numeric vector.
 * @returns {readonly number[]} Frozen numeric values.
 */
function freezeVector(vector) {
    return Object.freeze(Array.from(vector));
}

/**
 * Freeze one flat square matrix as JSON-compatible rows.
 *
 * @param {ArrayLike<number>} matrix - Flat square matrix.
 * @param {number} size - Matrix dimension.
 * @returns {readonly (readonly number[])[]} Frozen matrix rows.
 */
function freezeMatrix(matrix, size) {
    return Object.freeze(Array.from({ length: size }, (_, row) => Object.freeze(
        Array.from(matrix.slice(row * size, (row + 1) * size)),
    )));
}
