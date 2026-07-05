// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 3.3.1.
// - agents/topics/apps/flat/reconciliation/shader-design.md, descriptor setup lifecycle.

import {
    DistantSphericalShaderDescriptorBuilder,
} from '../index.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const failures = [];

await appendRunLog(recordDirectory, 'm3ShaderDescriptorProbe started.');

let descriptor = null;
let repeatedDescriptor = null;

try {
    const builder = new DistantSphericalShaderDescriptorBuilder();
    descriptor = builder.build();
    repeatedDescriptor = builder.build();
} catch (error) {
    failures.push(failure('descriptor-builder-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion(
        'descriptor-created',
        descriptor != null && typeof descriptor.fingerprint === 'string',
    ),
    criterion(
        'descriptor-build-deterministic',
        descriptor?.fingerprint === repeatedDescriptor?.fingerprint,
    ),
    criterion(
        'descriptor-covers-core-owner-sections',
        descriptor != null
        && [
            descriptor.spectralBasis,
            descriptor.geometry,
            descriptor.atmosphere,
            descriptor.lightSource,
            descriptor.cache,
            descriptor.transport,
            descriptor.color,
            descriptor.runtime,
        ].every((section) => typeof section?.fingerprint === 'string'),
    ),
    criterion(
        'descriptor-records-distant-spherical-cache-owned-texture-access',
        descriptor?.compatibilityTags?.includes('distant-light-source') === true
        && descriptor?.compatibilityTags?.includes('spherical-geometry') === true
        && descriptor?.cache?.compatibilityTags?.includes('cache-owned-texture-access') === true,
    ),
]);
for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Descriptor criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Finish Subgoal 3.3.1 by building a shader descriptor from the CPU-side
Algorithm32 contracts and confirming that descriptor fingerprints are stable.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.3.1',
    runner: 'm3ShaderDescriptorProbe',
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-33-shader-contract-and-source-assembly',
        'agents/topics/apps/flat/reconciliation/shader-design.md#setup-lifecycle',
        'scripts/flat/reconciliation/POC/src/constants/consts.js',
    ]),
});
await writeJson(recordDirectory, 'descriptor.json', descriptor);
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([
        Object.freeze({
            command: `node scripts/flat/reconciliation/POC/src/runners/m3ShaderDescriptorProbe.js --record ${recordDirectory}`,
            timestamp: nowIso(),
        }),
    ]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    descriptorFingerprint: descriptor?.fingerprint ?? null,
    failureCount: failures.length,
});
await writeText(recordDirectory, 'report.md', `# Report

Subgoal 3.3.1 descriptor probe finished with status: ${status}.

- Descriptor fingerprint: ${descriptor?.fingerprint ?? 'not-created'}.
- Criteria failures, if any, are listed in \`criteria-results.json\`.
`);
await appendRunLog(recordDirectory, `m3ShaderDescriptorProbe ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    descriptorFingerprint: descriptor?.fingerprint ?? null,
    failureCount: failures.length,
}));

function criterion(name, accepted) {
    return Object.freeze({
        name,
        status: accepted ? 'accepted' : 'rejected',
    });
}

function failure(id, message, details = null) {
    return Object.freeze({ id, message, details });
}
