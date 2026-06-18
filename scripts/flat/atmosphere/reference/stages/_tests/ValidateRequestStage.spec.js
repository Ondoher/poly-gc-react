import {
	createFlatInterfaceModelBundle,
	createModelBundle,
	createReferenceIntegrator,
	createValidTraceRequest,
	expectStageDescriptor,
	expectStagePrerequisiteFailure,
	REQUIRED_MODEL_METHODS,
} from '../../_tests/test-pipeline-stages.js';

const REQUEST_PHYSICAL_COEFFICIENT_FIELDS = Object.freeze([
	'absorptionCoefficientPerKm',
	'extinctionCoefficientPerKm',
	'mieScatteringCoefficientPerKm',
	'rayleighScatteringCoefficientPerKm',
	'scatteringCoefficientPerKm',
]);

const KNOWN_NUMERICAL_NUMBER_FIELDS = Object.freeze([
	'viewSteps',
	'sunTransmittanceSteps',
	'diffuseSkyHemisphereSamples',
	'finiteSunSamples',
	'minStepKm',
	'maxStepKm',
]);

const NUMERICAL_SAMPLE_COUNT_FIELDS = Object.freeze([
	'viewSteps',
	'sunTransmittanceSteps',
	'diffuseSkyHemisphereSamples',
	'finiteSunSamples',
]);

describe('atmosphere reference ValidateRequestStage', function() {
	describe('validateRequest', function() {
		function runValidateRequest(request, options) {
			const integrator = createReferenceIntegrator(options);
			const packet = integrator.createInitialPacket(request);

			return integrator.runStage('validateRequest', packet);
		}

		function expectValidateRequestRejects(request, pattern, options) {
			// Reason: invalid-input cases assert the named error contract for the rejected field.
			// Source: Reference Test Design, validateRequest invalid input; each caller supplies
			// the field-specific source breadcrumb beside the rejection case.
			expect(() => runValidateRequest(request, options)).toThrowError(pattern);
		}

		function snapshotModelBundle(model) {
			return {
				keys: Object.keys(model).sort(),
				physicalConstants: { ...model.physicalConstants },
				world: { ...model.world },
				atmosphere: { ...model.atmosphere },
				solarSource: { ...model.solarSource },
				surface: { ...model.surface },
			};
		}

		it('declares its stage contract', function() {
			// Reason: stage descriptor metadata is the public registry contract for this stage.
			// Source: Reference Code Design, Public API Shape; stage descriptors declare ids,
			// prerequisites, provided packet fields, and independently runnable stage semantics.
			expectStageDescriptor('validateRequest');
		});

		it('runs exactly one stage against a prepared packet', function() {
			const result = runValidateRequest(createValidTraceRequest());

			// Reason: a stage-level test must prove no hidden pipeline work ran.
			// Source: Reference Code Design, Public API Shape; direct stage runs append only their own stage id.
			expect(result.stageHistory).toEqual(['validateRequest']);
			// Reason: downstream stages consume one canonical request envelope.
			// Source: Reference Test Design, validateRequest; successful packet provides validatedRequest.
			expect(result.validatedRequest).toEqual(jasmine.any(Object));
		});

		it('fails loudly when prerequisites are missing', function() {
			// Reason: direct stage execution should fail at the stage boundary when required packet data is absent.
			// Source: Reference Code Design, Public API Shape; stages declare prerequisites and reject missing ones.
			expectStagePrerequisiteFailure('validateRequest');
		});

		describe('valid input -> canonical output', function() {
			it('accepts a globe model and returns a canonical validated request', function() {
				const request = createValidTraceRequest({
					model: createModelBundle({ geometryKind: 'globe' }),
				});

				const result = runValidateRequest(request);

				// Reason: a physically admissible globe request should become the canonical downstream envelope.
				// Source: Reference Test Design, validateRequest valid globe model canonical output.
				expect(result.validatedRequest).toEqual(jasmine.objectContaining({
					model: request.model,
					observer: { positionKm: [0, 0, 0] },
					// Reason: ray magnitude is not physical input; only orientation carries meaning.
					// Source: PBRT v4 Rays Section 3.6; ray direction supplies d in o + t*d.
					// Derivation: input ray.direction [0, 2, 0] normalizes to [0, 1, 0].
					ray: { direction: [0, 1, 0] },
					wavelengthsNm: [450, 550, 650],
					numerical: {
						viewSteps: 4,
						sunTransmittanceSteps: 2,
					},
				}));
			});

			it('accepts a flat model through the same model interface contract', function() {
				const model = createFlatInterfaceModelBundle();
				const request = createValidTraceRequest({ model });

				const result = runValidateRequest(request);

				// Reason: the integrator must not branch on globe vs flat world type or require a type tag.
				// Source: Reference Code Design, Model Interface; globe/flat models satisfy the same method contract.
				expect(Object.prototype.hasOwnProperty.call(model, 'geometryKind')).toBeFalse();
				expect(result.validatedRequest.model).toBe(request.model);
				for (const [owner, methods] of Object.entries(REQUIRED_MODEL_METHODS)) {
					for (const methodName of methods) {
						expect(typeof result.validatedRequest.model[owner][methodName])
							.withContext(`${owner}.${methodName}`)
							.toBe('function');
					}
				}
			});

			it('canonicalizes a finite nonzero ray direction to a unit vector', function() {
				const result = runValidateRequest(createValidTraceRequest({
					ray: { direction: [3, 4, 0] },
				}));

				// Reason: downstream path distances are in km and need a unit direction.
				// Source: PBRT v4 Rays Section 3.6 and Reference Code Design, Inputs;
				// ray direction defines orientation in o + t*d, and magnitude is not physical input here.
				// Derivation: length([3, 4, 0]) = 5, so unit direction is [3 / 5, 4 / 5, 0].
				expect(result.validatedRequest.ray.direction).toEqual([0.6, 0.8, 0]);
			});

			it('preserves a sorted wavelength grid in nanometers', function() {
				const wavelengthsNm = [360, 500, 830];
				const result = runValidateRequest(createValidTraceRequest({ wavelengthsNm }));

				// Reason: spectral integration must preserve the caller's physical wavelength samples.
				// Source: CIE 1931 CMF and ASTM G-173 tables use wavelength-indexed spectral data;
				// Reference Code Design makes wavelengthsNm the public nanometer input grid.
				expect(result.validatedRequest.wavelengthsNm).toEqual(wavelengthsNm);
			});

			it('accepts a single-wavelength grid for analytic fixtures', function() {
				const result = runValidateRequest(createValidTraceRequest({
					wavelengthsNm: [550],
				}));

				// Reason: analytic known-answer fixtures often validate one wavelength at a time.
				// Source: Reference Test Design, validateRequest hardening; CIE/G-173 are larger tables,
				// but our API accepts any nonempty sorted wavelength grid for analytic fixtures.
				expect(result.validatedRequest.wavelengthsNm).toEqual([550]);
			});

			it('merges numerical controls over integrator defaults', function() {
				const { observer, ray } = createValidTraceRequest();
				const result = runValidateRequest(
					{
						observer,
						ray,
						numerical: { viewSteps: 6 },
					},
					{
						model: createModelBundle(),
						wavelengthsNm: [500],
						numerical: {
							viewSteps: 12,
							sunTransmittanceSteps: 5,
						},
					},
				);

				// Reason: numerical controls are calculation settings, so per-run overrides must be explicit.
				// Source: Reference Code Design, mergeRequest API; per-call numerical controls override defaults.
				expect(result.validatedRequest.numerical).toEqual({
					viewSteps: 6,
					sunTransmittanceSteps: 5,
				});
			});

			it('accepts zero distance step controls as valid numerical limits', function() {
				const result = runValidateRequest(createValidTraceRequest({
					numerical: {
						viewSteps: 4,
						sunTransmittanceSteps: 2,
						minStepKm: 0,
						maxStepKm: 0,
					},
				}));

				// Reason: zero is a valid boundary value; the distance span must be nonnegative.
				// Source: Reference Code Design, Numerical Controls; maxStepKm - minStepKm must not be negative.
				expect(result.validatedRequest.numerical).toEqual({
					viewSteps: 4,
					sunTransmittanceSteps: 2,
					minStepKm: 0,
					maxStepKm: 0,
				});
			});

			it('drops unknown numerical keys while preserving known dispatch controls', function() {
				const result = runValidateRequest(createValidTraceRequest({
					numerical: {
						viewSteps: 4,
						integrationMethod: 'registry-owned-method',
						typoOrFutureField: 123,
					},
				}));

				// Reason: later stages should only see controls owned by the numerical-control contract.
				// Source: Reference Code Design, Numerical Controls; unknown-key rejection belongs to schema validation,
				// while integrationMethod support is owned by the future method registry/implementation.
				expect(result.validatedRequest.numerical).toEqual({
					viewSteps: 4,
					integrationMethod: 'registry-owned-method',
				});
			});

			it('keeps physical constants owned by the model bundle', function() {
				const model = createModelBundle();

				const result = runValidateRequest(createValidTraceRequest({ model }));

				// Reason: physical constants must have one owner to avoid shadow magic numbers.
				// Source: Reference Test Design, validateRequest; physical constants remain model-owned.
				expect(result.validatedRequest.model.physicalConstants).toBe(model.physicalConstants);
			});

			it('does not use validateRequest as a generic allowed-property schema', function() {
				const result = runValidateRequest(createValidTraceRequest({
					extraFields: {
						camera: {},
						display: {},
						metadata: { id: 'schema-owned-later' },
						output: {},
					},
				}));

				// Reason: stage code validates the consumed input shape while tolerating unrelated extras.
				// Source: Reference Stage Contracts, Contract Rules; generic allowed-property checks belong
				// to future schema validation, while tests assert the contracted output fields.
				expect(result.validatedRequest).toEqual(jasmine.objectContaining({
					model: jasmine.any(Object),
					observer: { positionKm: [0, 0, 0] },
					ray: { direction: [0, 1, 0] },
					wavelengthsNm: [450, 550, 650],
					numerical: {
						viewSteps: 4,
						sunTransmittanceSteps: 2,
					},
				}));
			});

			it('accepts request-level physical coefficient extras without changing contracted output fields', function() {
				for (const field of REQUEST_PHYSICAL_COEFFICIENT_FIELDS) {
					const result = runValidateRequest(createValidTraceRequest({
						extraFields: { [field]: [1] },
					}));

					// Reason: physical coefficients have one canonical owner: the model bundle.
					// Source: Reference Stage Contracts, validateRequest output contract; extra input fields
					// do not change the contracted output fields.
					expect(result.validatedRequest).toEqual(jasmine.objectContaining({
						model: jasmine.any(Object),
						observer: { positionKm: [0, 0, 0] },
						ray: { direction: [0, 1, 0] },
						wavelengthsNm: [450, 550, 650],
						numerical: {
							viewSteps: 4,
							sunTransmittanceSteps: 2,
						},
					}));
				}
			});

			it('does not mutate the original request object', function() {
				const request = createValidTraceRequest({
					ray: { direction: [0, 2, 0] },
				});
				const before = structuredClone({
					observer: request.observer,
					ray: request.ray,
					wavelengthsNm: request.wavelengthsNm,
					numerical: request.numerical,
				});

				runValidateRequest(request);

				// Reason: validation produces canonical data without rewriting the caller's source input.
				// Source: Reference Test Design, validateRequest; original request object is not mutated.
				expect({
					observer: request.observer,
					ray: request.ray,
					wavelengthsNm: request.wavelengthsNm,
					numerical: request.numerical,
				}).toEqual(before);
			});

			it('does not mutate integrator default numerical controls or wavelength grid', function() {
				const defaultWavelengthsNm = [500, 600];
				const defaultNumerical = { viewSteps: 8, sunTransmittanceSteps: 3 };
				const { model, observer, ray } = createValidTraceRequest();
				const before = {
					wavelengthsNm: [...defaultWavelengthsNm],
					numerical: { ...defaultNumerical },
				};

				runValidateRequest(
					{
						model,
						observer,
						ray,
						numerical: { viewSteps: 2 },
					},
					{
						model: createModelBundle(),
						wavelengthsNm: defaultWavelengthsNm,
						numerical: defaultNumerical,
					},
				);

				// Reason: defaults are reusable configuration, not scratch storage for one validation run.
				// Source: Reference Test Design, validateRequest hardening; integrator defaults must not be mutated.
				expect(defaultWavelengthsNm).toEqual(before.wavelengthsNm);
				expect(defaultNumerical).toEqual(before.numerical);
			});

			it('does not mutate the integrator default model bundle', function() {
				const defaultModel = createModelBundle();
				const {
					observer,
					ray,
					wavelengthsNm,
					numerical,
				} = createValidTraceRequest();
				const before = snapshotModelBundle(defaultModel);

				const result = runValidateRequest(
					{
						observer,
						ray,
						wavelengthsNm,
						numerical,
					},
					{
						model: defaultModel,
					},
				);

				// Reason: the model bundle owns physical constants and behavior modules; defaults must remain reusable.
				// Source: Reference Test Design, validateRequest hardening; integrator defaults must not be mutated.
				expect(result.validatedRequest.model).toBe(defaultModel);
				expect(snapshotModelBundle(defaultModel)).toEqual(before);
			});

			it('writes validatedRequest and stage history for the packet', function() {
				const result = runValidateRequest(createValidTraceRequest());

				// Reason: downstream stages need validatedRequest, not a placeholder marker.
				// Source: Reference Test Design, validateRequest; successful packet contains validatedRequest and stage history.
				expect(result.validatedRequest).toEqual(jasmine.any(Object));
				expect(result.stageHistory).toEqual(['validateRequest']);
			});
		});

		describe('invalid input -> named error', function() {
			it('rejects a missing request object', function() {
				// Reason: without a request envelope there is no physical or numerical input to validate.
				// Source: Reference Test Design, validateRequest invalid input; missing request names request.
				expect(() => {
					createReferenceIntegrator().runStage('validateRequest', {
						request: null,
						stageHistory: [],
					});
				}).toThrowError(/request/);
			});

			it('rejects a missing observer position', function() {
				// Reason: ray geometry needs a finite origin in model coordinates.
				// Source: PBRT v4 Rays Section 3.6 and Reference Code Design, Inputs;
				// observer.positionKm supplies the ray origin in kilometers.
				expectValidateRequestRejects(
					createValidTraceRequest({ observer: {} }),
					/observer\.positionKm/,
				);
			});

			it('rejects invalid observer vector values', function() {
				for (const positionKm of [
					[0, 0],
					[0, 0, 0, 0],
					null,
					[Infinity, 0, 0],
					[NaN, 0, 0],
				]) {
					// Reason: non-3-vector or non-finite positions make intersections and altitude undefined.
					// Source: PBRT v4 Rays Section 3.6 and Reference Code Design, Units;
					// ray origins are finite 3D points, and this model stores them in kilometers.
					expectValidateRequestRejects(
						createValidTraceRequest({ observer: { positionKm } }),
						/observer\.positionKm/,
					);
				}
			});

			it('rejects a missing ray direction', function() {
				// Reason: a ray without direction cannot define a transport path.
				// Source: PBRT v4 Rays Section 3.6 and Reference Code Design, Inputs;
				// ray.direction supplies d in o + t*d.
				expectValidateRequestRejects(
					createValidTraceRequest({ ray: {} }),
					/ray\.direction/,
				);
			});

			it('rejects invalid ray direction vector values', function() {
				for (const direction of [
					[0, 1],
					[0, 1, 0, 0],
					null,
					[Infinity, 0, 0],
					[NaN, 0, 0],
				]) {
					// Reason: a ray direction must be a finite 3-vector before it can define orientation.
					// Source: PBRT v4 Rays Section 3.6 and Reference Code Design, Inputs;
					// direction is the vector basis for ray evaluation.
					expectValidateRequestRejects(
						createValidTraceRequest({ ray: { direction } }),
						/ray\.direction/,
					);
				}
			});

			it('rejects ray directions too small to define an orientation', function() {
				// Reason: a zero vector has no orientation and cannot be normalized.
				// Source: PBRT v4 Rays Section 3.6 and Reference Code Design, Inputs;
				// d must define a usable orientation for o + t*d.
				expectValidateRequestRejects(
					createValidTraceRequest({ ray: { direction: [0, 0, 0] } }),
					/ray\.direction/,
				);
			});

			it('rejects near-zero ray directions that cannot define a stable orientation', function() {
				// Reason: transport paths need a numerically stable unit direction, not just a nonzero bit pattern.
				// Source: PBRT v4 Rays Section 3.6 and Reference Test Design, validateRequest hardening;
				// the stage owns the usable-orientation policy before unit-vector canonicalization.
				expectValidateRequestRejects(
					createValidTraceRequest({ ray: { direction: [1e-20, 0, 0] } }),
					/ray\.direction/,
				);
			});

			it('rejects an empty wavelength grid', function() {
				// Reason: spectral transport needs at least one wavelength sample.
				// Source: CIE 1931 CMF and ASTM G-173 tables are wavelength-indexed;
				// Reference Code Design makes wavelengthsNm the required spectral sample grid.
				expectValidateRequestRejects(
					createValidTraceRequest({ wavelengthsNm: [] }),
					/wavelengthsNm/,
				);
			});

			it('rejects unsorted, duplicate, non-finite, or non-positive wavelengths', function() {
				for (const wavelengthsNm of [
					[550, 450],
					[450, 450],
					[450, Infinity],
					[450, 0],
					[450, -1],
				]) {
					// Reason: wavelength is positive, and ordered unique grids keep interpolation/integration unambiguous.
					// Source: CIE 1931 CMF and ASTM G-173 tables provide finite ordered wavelength grids;
					// this integrator generalizes that to positive, finite, strictly increasing nm samples.
					expectValidateRequestRejects(
						createValidTraceRequest({ wavelengthsNm }),
						/wavelengthsNm/,
					);
				}
			});

			it('rejects negative or non-finite numerical controls', function() {
				for (const numerical of [
					{ viewSteps: -1 },
					{ viewSteps: Infinity },
					{ sunTransmittanceSteps: -1 },
					{ sunTransmittanceSteps: NaN },
					{ minStepKm: -0.001 },
					{ maxStepKm: -0.001 },
					{ minStepKm: -2, maxStepKm: -1 },
				]) {
					// Reason: sample counts and step controls drive loops/quadrature and cannot be negative or non-finite.
					// Source: Reference Code Design, Numerical Controls; controls are nonnegative approximation settings, not physical constants.
					expectValidateRequestRejects(
						createValidTraceRequest({ numerical }),
						/numerical/,
					);
				}
			});

			it('rejects distance step ranges where max is less than min', function() {
				// Reason: a negative step span would make distance subdivision ambiguous.
				// Source: Reference Code Design, Numerical Controls; maxStepKm - minStepKm must be nonnegative.
				expectValidateRequestRejects(
					createValidTraceRequest({
						numerical: {
							viewSteps: 4,
							minStepKm: 2,
							maxStepKm: 1,
						},
					}),
					/numerical\.maxStepKm/,
				);
			});

			it('rejects string values for known numerical number controls', function() {
				for (const field of KNOWN_NUMERICAL_NUMBER_FIELDS) {
					// Reason: numerical controls are numbers; accepting strings would hide config mistakes.
					// Source: Reference Test Design, validateRequest hardening; do not coerce numeric controls.
					expectValidateRequestRejects(
						createValidTraceRequest({ numerical: { [field]: '4' } }),
						new RegExp(`numerical\\.${field}`),
					);
				}
			});

			it('rejects non-positive or fractional numerical sample counts', function() {
				for (const field of NUMERICAL_SAMPLE_COUNT_FIELDS) {
					for (const value of [0, 1.5]) {
						// Reason: sample counts choose how many loop samples exist; zero or fractional samples are undefined.
						// Source: Reference Test Design, validateRequest numerical-control schema;
						// count controls are positive integers, unlike distance controls such as minStepKm/maxStepKm.
						expectValidateRequestRejects(
							createValidTraceRequest({ numerical: { [field]: value } }),
							new RegExp(`numerical\\.${field}`),
						);
					}
				}
			});

			it('rejects missing required model owner objects', function() {
				for (const owner of Object.keys(REQUIRED_MODEL_METHODS)) {
					const model = createModelBundle();
					delete model[owner];

					// Reason: each model owner represents a required physical behavior boundary.
					// Source: Reference Code Design, Model Interface; missing owner objects cannot satisfy the interface.
					expectValidateRequestRejects(
						createValidTraceRequest({ model }),
						new RegExp(`${owner}\\.`),
					);
				}
			});

			it('rejects missing required model interface methods', function() {
				for (const [owner, methods] of Object.entries(REQUIRED_MODEL_METHODS)) {
					for (const methodName of methods) {
						const model = createModelBundle();
						delete model[owner][methodName];

						// Reason: later stages call these model methods instead of branching on model type.
						// Source: Reference Code Design, Model Interface; each model owner must provide its required methods.
						expectValidateRequestRejects(
							createValidTraceRequest({ model }),
							new RegExp(`${owner}\\.${methodName}`),
						);
					}
				}
			});

		});
	});

	});
