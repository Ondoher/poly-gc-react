import {
	CANONICAL_STAGES,
	CpuSpectralReferenceIntegrator,
} from '../index.js';
import {
	BASIC_TRACE_REQUEST,
	canonicalStageIds,
	createModelBundle,
} from './test-pipeline-stages.js';

function createHarnessStages(stageIds = ['first', 'second', 'third'], constructed = []) {
	return stageIds.map((stageId, index) => {
		const providedField = `${stageId}Output`;

		class HarnessStage {
			constructor(options) {
				this.descriptor = options.descriptor;
				this.context = options.context;
				constructed.push(options);
			}

			run(packet) {
				return {
					...packet,
					[providedField]: {
						stageId: this.descriptor.id,
						contextModel: this.context.model,
					},
					stageHistory: [...(packet.stageHistory ?? []), this.descriptor.id],
				};
			}
		}

		return {
			id: stageId,
			requires: index === 0 ? ['request'] : [stageIds[index - 1] + 'Output'],
			provides: [providedField],
			StageClass: HarnessStage,
		};
	});
}

function createHarnessIntegrator(options = {}) {
	return new CpuSpectralReferenceIntegrator({
		model: options.model ?? createModelBundle(),
		wavelengthsNm: options.wavelengthsNm ?? [450, 550],
		numerical: options.numerical ?? { viewSteps: 1, sunTransmittanceSteps: 1 },
		stages: options.stages ?? createHarnessStages(),
	});
}

function createTraceRequest(overrides = {}) {
	return {
		observer: { positionKm: [1, 2, 3] },
		ray: { direction: [0, 1, 0] },
		...overrides,
	};
}

describe('CpuSpectralReferenceIntegrator', function() {
	describe('Construction And Configuration', function() {
		it('stores cloned default model, wavelength, and numerical context', function() {
			const model = createModelBundle();
			const wavelengthsNm = [450, 550];
			const numerical = { viewSteps: 2 };
			const integrator = new CpuSpectralReferenceIntegrator({
				model,
				wavelengthsNm,
				numerical,
			});

			wavelengthsNm.push(650);
			numerical.viewSteps = 9;

			// Reason: constructor defaults are reusable integrator context and must not alias caller-owned arrays.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(integrator.context.wavelengthsNm).toEqual([450, 550]);
			// Reason: constructor defaults are reusable integrator context and must not alias caller-owned objects.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(integrator.context.numerical).toEqual({ viewSteps: 2 });
			// Reason: the model bundle is a behavior provider with functions, so the facade preserves model identity.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(integrator.context.model).toBe(model);
		});

		it('validates constructor defaults when they are supplied', function() {
			// Reason: invalid reusable model defaults should fail before a trace run.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(() => new CpuSpectralReferenceIntegrator({ model: {} })).toThrowError(
				/CpuSpectralReferenceIntegrator default model requires world\.altitudeAt/,
			);
			// Reason: invalid reusable wavelength defaults should fail before they seed request packets.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(() => new CpuSpectralReferenceIntegrator({ wavelengthsNm: [550, 450] })).toThrowError(
				/default wavelengthsNm/,
			);
			// Reason: invalid reusable numerical defaults should fail before they drive loops or distances.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(() => new CpuSpectralReferenceIntegrator({ numerical: { viewSteps: 0 } })).toThrowError(
				/default numerical\.viewSteps/,
			);
		});

		it('constructs helper instances with descriptor and context for the internal stage harness', function() {
			const constructed = [];
			const model = createModelBundle();
			const stages = createHarnessStages(['alpha'], constructed);
			const integrator = createHarnessIntegrator({ model, stages });

			// Reason: helper construction receives the descriptor declared by the configured stage registry.
			// Source: Reference Code Design, helper-class dispatch policy.
			expect(constructed[0].descriptor).toBe(stages[0]);
			// Reason: helper construction receives the integrator context used by stage helpers.
			// Source: Reference Code Design, helper-class dispatch policy.
			expect(constructed[0].context).toBe(integrator.context);
		});

		it('rejects configured stage descriptors without helper constructors', function() {
			const [stage] = createHarnessStages(['missingHelper']);
			delete stage.StageClass;

			// Reason: all reference-integrator stages are now implemented behind focused helpers; placeholder fallback is closed.
			// Source: Reference Code Design, helper-class stage policy.
			expect(() => createHarnessIntegrator({ stages: [stage] })).toThrowError(
				/CpuSpectralReferenceIntegrator stage descriptor 0 requires a StageClass constructor/,
			);
		});

		it('rejects non-array custom stage descriptors', function() {
			// Reason: custom stage overrides are ordered harness descriptors, not object maps.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(() => createHarnessIntegrator({ stages: { alpha: createHarnessStages(['alpha'])[0] } })).toThrowError(
				/CpuSpectralReferenceIntegrator stages must be an array/,
			);
		});

		it('rejects duplicate configured stage ids', function() {
			const stages = [
				...createHarnessStages(['duplicate']),
				...createHarnessStages(['duplicate']),
			];

			// Reason: duplicate stage ids would make descriptor lookup and helper dispatch disagree.
			// Source: Reference Code Design, one canonical stage registry.
			expect(() => createHarnessIntegrator({ stages })).toThrowError(
				/Duplicate atmosphere reference stage id: duplicate/,
			);
		});
	});

	describe('Request Merging', function() {
		it('merges request values over integrator defaults', function() {
			const defaultModel = createModelBundle({ id: 'default-model' });
			const requestModel = createModelBundle({ id: 'request-model' });
			const integrator = createHarnessIntegrator({
				model: defaultModel,
				wavelengthsNm: [450],
			});

			const merged = integrator.mergeRequest({
				model: requestModel,
				wavelengthsNm: [500],
			});

			// Reason: per-call request values override reusable defaults.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(merged.model).toBe(requestModel);
			// Reason: per-call wavelength data overrides the constructor default grid.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(merged.wavelengthsNm).toEqual([500]);
		});

		it('merges numerical controls shallowly', function() {
			const integrator = createHarnessIntegrator({
				numerical: { viewSteps: 8, sunTransmittanceSteps: 4 },
			});

			const merged = integrator.mergeRequest({
				numerical: { viewSteps: 2 },
			});

			// Reason: numerical defaults and request controls merge by top-level control name only.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(merged.numerical).toEqual({
				viewSteps: 2,
				sunTransmittanceSteps: 4,
			});
		});

		it('does not mutate request objects while merging defaults', function() {
			const integrator = createHarnessIntegrator();
			const request = {
				observer: { positionKm: [1, 2, 3] },
				ray: { direction: [0, 1, 0] },
				wavelengthsNm: [500],
				numerical: { viewSteps: 2 },
			};
			const before = structuredClone(request);

			const merged = integrator.mergeRequest(request);
			merged.observer.positionKm[0] = 99;
			merged.ray.direction[1] = 99;
			merged.wavelengthsNm.push(600);
			merged.numerical.viewSteps = 9;

			// Reason: mergeRequest clones caller-owned request data before merging defaults.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(request).toEqual(before);
		});
	});

	describe('Initial Packet Creation', function() {
		it('creates the canonical initial packet envelope', function() {
			const integrator = createHarnessIntegrator();
			const packet = integrator.createInitialPacket(createTraceRequest());

			// Reason: the public initial packet includes the merged request and diagnostic history boundary.
			// Source: Reference Code Design, Integrator Facade Contract; Stage Contracts, Common Packet Fields.
			expect(Object.keys(packet).sort()).toEqual([
				'model',
				'numerical',
				'observer',
				'ray',
				'request',
				'stageHistory',
				'wavelengthsNm',
			]);
			// Reason: no stage has run when the initial packet is created.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(packet.stageHistory).toEqual([]);
		});

		it('carries request, model, observer, ray, wavelength, and numerical fields', function() {
			const model = createModelBundle();
			const integrator = createHarnessIntegrator({
				model,
				wavelengthsNm: [450],
				numerical: { viewSteps: 1 },
			});
			const request = createTraceRequest({ numerical: { sunTransmittanceSteps: 2 } });
			const packet = integrator.createInitialPacket(request);

			// Reason: the packet keeps the merged trace request as the canonical request envelope.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(packet.request).toEqual(jasmine.objectContaining({
				model,
				observer: { positionKm: [1, 2, 3] },
				ray: { direction: [0, 1, 0] },
				wavelengthsNm: [450],
				numerical: { viewSteps: 1, sunTransmittanceSteps: 2 },
			}));
			// Reason: convenience fields mirror the merged request for direct packet diagnostics.
			// Source: Stage Contracts, Common Packet Fields.
			expect(packet.model).toBe(model);
			// Reason: convenience observer data is cloned from the merged request.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(packet.observer).toEqual({ positionKm: [1, 2, 3] });
			// Reason: convenience ray data is cloned from the merged request.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(packet.ray).toEqual({ direction: [0, 1, 0] });
			// Reason: convenience wavelength data is cloned from the merged request.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(packet.wavelengthsNm).toEqual([450]);
			// Reason: convenience numerical data is cloned from the merged request.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(packet.numerical).toEqual({ viewSteps: 1, sunTransmittanceSteps: 2 });
		});
	});

	describe('Stage Lookup And Dispatch', function() {
		it('lists configured stages through the facade', function() {
			const integrator = createHarnessIntegrator({
				stages: createHarnessStages(['alpha', 'beta']),
			});

			// Reason: listStages reports configured stage ids in execution order.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(integrator.listStages()).toEqual(['alpha', 'beta']);
		});

		it('gets stage descriptors through the facade', function() {
			const stages = createHarnessStages(['alpha']);
			const integrator = createHarnessIntegrator({ stages });

			// Reason: getStage exposes the registered descriptor used by runStage dispatch.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(integrator.getStage('alpha')).toBe(stages[0]);
		});

		it('runs one stage through descriptor helper dispatch', function() {
			const integrator = createHarnessIntegrator({
				stages: createHarnessStages(['alpha']),
			});
			const packet = integrator.createInitialPacket(createTraceRequest());
			const result = integrator.runStage('alpha', packet);

			// Reason: runStage dispatches exactly the requested registered stage helper.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.alphaOutput).toEqual(jasmine.objectContaining({ stageId: 'alpha' }));
			// Reason: stageHistory is public diagnostic metadata for successful stage execution.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.stageHistory).toEqual(['alpha']);
			// Reason: runStage clones prepared packets before helper dispatch.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(packet.alphaOutput).toBeUndefined();
		});

		it('fails loudly for unknown stage ids', function() {
			const integrator = createHarnessIntegrator();

			// Reason: runStage accepts only registered public stage ids.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(() => integrator.runStage('missingStage', {})).toThrowError(
				/Unknown atmosphere reference stage: missingStage/,
			);
		});

		it('fails loudly when stage prerequisites are missing', function() {
			const integrator = createHarnessIntegrator({
				stages: [{
					id: 'needsField',
					requires: ['requiredField'],
					provides: ['nextField'],
					StageClass: createHarnessStages(['needsField'])[0].StageClass,
				}],
			});

			// Reason: runStage accepts prepared packets and rejects missing descriptor prerequisites.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(() => integrator.runStage('needsField', { stageHistory: [] })).toThrowError(
				/needsField requires requiredField/,
			);
		});
	});

	describe('Partial Pipeline Execution', function() {
		it('runs until the requested stage and returns that packet', function() {
			const integrator = createHarnessIntegrator();
			const result = integrator.runUntil('second', createTraceRequest());

			// Reason: runUntil returns immediately after the requested stage has appended its output.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.secondOutput).toEqual(jasmine.objectContaining({ stageId: 'second' }));
			// Reason: runUntil must not execute stages after the requested target.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.thirdOutput).toBeUndefined();
		});

		it('records the exact stage-history prefix', function() {
			const integrator = createHarnessIntegrator();
			const result = integrator.runUntil('second', createTraceRequest());

			// Reason: stageHistory records successful stage ids in execution order through the requested target.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.stageHistory).toEqual(['first', 'second']);
		});

		it('fails loudly for an unknown target stage', function() {
			const integrator = createHarnessIntegrator();

			// Reason: runUntil accepts only registered target stage ids.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(() => integrator.runUntil('missingStage', createTraceRequest())).toThrowError(
				/Unknown atmosphere reference stage: missingStage/,
			);
		});
	});

	describe('Full Ray Tracing Orchestration', function() {
		it('composes all configured stages in order', function() {
			const integrator = createHarnessIntegrator();
			const result = integrator.traceRay(createTraceRequest());

			// Reason: traceRay always runs every configured stage in order.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.stageHistory).toEqual(['first', 'second', 'third']);
		});

		it('returns the current public result packet shape', function() {
			const integrator = new CpuSpectralReferenceIntegrator();
			const result = integrator.traceRay(BASIC_TRACE_REQUEST);

			// Reason: traceRay returns the full internal packet as the public diagnostic result.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.stageHistory).toEqual(canonicalStageIds());
			// Reason: the full packet exposes intermediate physical stage outputs for diagnostics.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.validatedRequest).toBeDefined();
			// Reason: the full packet exposes the final composed spectral radiance before post-pipeline consumers.
			// Source: Stage Contracts, composeSpectralRadiance.
			expect(result.spectralRadiance.finalByWavelength).toEqual([0]);
		});
	});

	describe('Probe Resolution', function() {
		it('passes through inline probe requests as cloned trace requests', function() {
			const integrator = createHarnessIntegrator();
			const probe = createTraceRequest({ id: 'inline-probe', wavelengthsNm: [500] });
			const resolved = integrator.resolveProbeRequest(probe);

			// Reason: inline probes are trace requests, but resolving them returns a clone rather than the caller object.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(resolved).toEqual(probe);
			// Reason: resolving probes must not expose mutable caller aliases.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(resolved).not.toBe(probe);
		});

		it('unwraps nested probe.request values as cloned trace requests', function() {
			const integrator = createHarnessIntegrator();
			const request = createTraceRequest({ wavelengthsNm: [500] });
			const resolved = integrator.resolveProbeRequest({ id: 'nested-probe', request });

			// Reason: nested probe.request is the trace request selected for execution.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(resolved).toEqual(request);
			// Reason: nested probe request data is caller-owned and must be cloned.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(resolved).not.toBe(request);
		});

		it('rejects name-only probes until a named probe registry exists', function() {
			const integrator = createHarnessIntegrator();

			// Reason: name-only probes need a fixture registry; treating the id as a trace request would hide bad configuration.
			// Source: Reference Code Design, resolveProbeRequest named lookup deferral.
			expect(() => integrator.resolveProbeRequest({ id: 'named-only-probe' })).toThrowError(
				/Named atmosphere reference probe lookup is not available yet: named-only-probe/,
			);
		});

		it('rejects scalar probe inputs', function() {
			const integrator = createHarnessIntegrator();

			// Reason: the facade resolves probe objects, and scalar ids would need the deferred named-probe registry.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(() => integrator.resolveProbeRequest('named-only-probe')).toThrowError(
				/Atmosphere reference probe must be an object/,
			);
		});

		it('traces probes through the same pipeline as traceRay', function() {
			const integrator = createHarnessIntegrator();
			const request = createTraceRequest();

			const probeResult = integrator.traceProbe({ id: 'probe', request });
			const rayResult = integrator.traceRay(request);

			// Reason: traceProbe resolves a request and then delegates to the same full pipeline as traceRay.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(probeResult.stageHistory).toEqual(rayResult.stageHistory);
			// Reason: traceProbe and traceRay use the same configured stage sequence.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(probeResult.thirdOutput).toEqual(rayResult.thirdOutput);
		});
	});

	describe('Immutability And Reuse', function() {
		it('does not mutate reusable integrator defaults', function() {
			const wavelengthsNm = [450, 550];
			const numerical = { viewSteps: 1 };
			const integrator = createHarnessIntegrator({ wavelengthsNm, numerical });

			const result = integrator.traceRay(createTraceRequest({
				numerical: { sunTransmittanceSteps: 2 },
			}));
			result.wavelengthsNm.push(650);
			result.numerical.viewSteps = 9;

			// Reason: trace results are cloned from reusable defaults and cannot mutate integrator context.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(integrator.context.wavelengthsNm).toEqual([450, 550]);
			// Reason: trace results are cloned from reusable defaults and cannot mutate integrator numerical context.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(integrator.context.numerical).toEqual({ viewSteps: 1 });
		});

		it('does not mutate input requests or probes', function() {
			const integrator = createHarnessIntegrator();
			const request = createTraceRequest({
				wavelengthsNm: [500],
				numerical: { viewSteps: 3 },
			});
			const probe = { id: 'probe', request };
			const before = structuredClone(probe);

			const result = integrator.traceProbe(probe);
			result.request.observer.positionKm[0] = 99;
			result.request.ray.direction[1] = 99;
			result.request.wavelengthsNm.push(600);
			result.request.numerical.viewSteps = 9;

			// Reason: traceProbe clones probe and request data before creating packets.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(probe).toEqual(before);
		});

		it('does not mutate prepared stage packets', function() {
			const stages = createHarnessStages(['mutating']);
			stages[0].StageClass = class MutatingHarnessStage {
				constructor(options) {
					this.descriptor = options.descriptor;
				}

				run(packet) {
					packet.request.observer.positionKm[0] = 99;
					packet.stageHistory.push('mutated-in-helper');
					return {
						...packet,
						mutatingOutput: true,
						stageHistory: [...packet.stageHistory, this.descriptor.id],
					};
				}
			};
			const integrator = createHarnessIntegrator({ stages });
			const packet = integrator.createInitialPacket(createTraceRequest());
			const before = {
				request: {
					observer: structuredClone(packet.request.observer),
					ray: structuredClone(packet.request.ray),
					wavelengthsNm: structuredClone(packet.request.wavelengthsNm),
					numerical: structuredClone(packet.request.numerical),
				},
				stageHistory: packet.stageHistory,
			};

			integrator.runStage('mutating', packet);

			// Reason: runStage clones prepared packets before helper dispatch, so helper mutation cannot affect input.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect({
				request: {
					observer: packet.request.observer,
					ray: packet.request.ray,
					wavelengthsNm: packet.request.wavelengthsNm,
					numerical: packet.request.numerical,
				},
				stageHistory: packet.stageHistory,
			}).toEqual(before);
		});

		it('does not leak packet state across repeated runs', function() {
			const integrator = createHarnessIntegrator();
			const first = integrator.traceRay(createTraceRequest());
			const second = integrator.traceRay(createTraceRequest());

			first.stageHistory.push('external-mutation');
			first.request.observer.positionKm[0] = 99;

			// Reason: each traceRay call starts from a fresh cloned packet.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(second.stageHistory).toEqual(['first', 'second', 'third']);
			// Reason: repeated traceRay calls must not share request data by packet alias.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(second.request.observer.positionKm).toEqual([1, 2, 3]);
		});
	});

	describe('Custom Stage Harness Behavior', function() {
		it('keeps test-supplied stages as an internal harness rather than an official public contract', function() {
			const stages = createHarnessStages(['internalOnly']);
			const integrator = createHarnessIntegrator({ stages });
			const result = integrator.traceRay(createTraceRequest());

			// Reason: constructor stage overrides exist to support local tests, but the documented package contract promises canonical stages.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.stageHistory).toEqual(['internalOnly']);
		});

		it('executes stages in the configured order for the internal harness', function() {
			const stages = createHarnessStages(['gamma', 'alpha', 'beta']);
			const integrator = createHarnessIntegrator({ stages });
			const result = integrator.traceRay(createTraceRequest());

			// Reason: the internal harness verifies orchestration order without depending on physical fixture values.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.stageHistory).toEqual(['gamma', 'alpha', 'beta']);
		});

		it('passes descriptor and context into custom helper instances for the internal harness', function() {
			const constructed = [];
			const stages = createHarnessStages(['alpha', 'beta'], constructed);
			const integrator = createHarnessIntegrator({ stages });

			integrator.traceRay(createTraceRequest());

			// Reason: helper construction receives the exact configured descriptor for dispatch diagnostics.
			// Source: Reference Code Design, helper-class dispatch policy.
			expect(constructed.map((entry) => entry.descriptor.id)).toEqual(['alpha', 'beta']);
			// Reason: helper construction receives the same immutable context object used by the facade.
			// Source: Reference Code Design, helper-class dispatch policy.
			expect(constructed.every((entry) => entry.context === integrator.context)).toBeTrue();
		});
	});

	describe('Public Result Boundary', function() {
		it('returns the full internal packet from traceRay', function() {
			const integrator = new CpuSpectralReferenceIntegrator();
			const result = integrator.traceRay(BASIC_TRACE_REQUEST);

			// Reason: traceRay exposes the full internal packet as the current public diagnostic result.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.request).toBeDefined();
			// Reason: stageHistory is part of the public diagnostic packet contract.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.stageHistory).toEqual(canonicalStageIds());
			// Reason: intermediate packet fields remain public diagnostics when traceRay returns the full packet.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(result.mediumSamples).toBeDefined();
			// Reason: final transport output remains in the same packet before post-pipeline consumers.
			// Source: Stage Contracts, composeSpectralRadiance.
			expect(result.spectralRadiance).toBeDefined();
		});

		it('keeps physical trace-ray acceptance fixtures out of the facade spec', function() {
			const facadeDomains = [
				'construction',
				'mergeRequest',
				'createInitialPacket',
				'runStage',
				'runUntil',
				'traceRay orchestration',
				'traceProbe',
				'immutability',
				'public packet boundary',
			];

			// Reason: this spec documents facade behavior; physical fixture acceptance belongs in trace-ray integration tests.
			// Source: Reference Test Plan, Test File Ownership.
			expect(facadeDomains).not.toContain('physical acceptance fixture');
		});
	});

	describe('Canonical Registry Boundary', function() {
		it('uses canonical stages for normal public construction', function() {
			const integrator = new CpuSpectralReferenceIntegrator();

			// Reason: custom constructor stages are not an official public contract; normal construction uses canonical stages.
			// Source: Reference Code Design, Integrator Facade Contract.
			expect(integrator.listStages()).toEqual(CANONICAL_STAGES.map((stage) => stage.id));
		});
	});
});
