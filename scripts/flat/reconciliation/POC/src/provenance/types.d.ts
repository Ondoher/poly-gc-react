type ParameterLedgerEntry = {
    readonly id: string;
    readonly owner: string;
    readonly value: unknown;
    readonly unitsOrKind: string;
    readonly provenanceClassification:
        | 'external-source'
        | 'source-backed-derivation'
        | 'accepted-experiment-decision'
        | 'authored-model-config'
        | 'display-fixture'
        | 'unresolved';
    readonly sourceOrDecision: string;
    readonly verificationStatus: 'accepted' | 'pending' | 'unresolved';
    readonly notes: string;
};

