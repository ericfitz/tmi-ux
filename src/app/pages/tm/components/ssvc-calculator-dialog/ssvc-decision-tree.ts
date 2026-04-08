/** Short codes for Exploitation decision point */
export type SsvcExploitation = 'N' | 'P' | 'A';

/** Short codes for Utility decision point */
export type SsvcUtility = 'L' | 'E' | 'S';

/** Short codes for Technical Impact decision point */
export type SsvcTechnicalImpact = 'P' | 'T';

/** Short codes for Public Safety Impact decision point */
export type SsvcPublicSafetyImpact = 'M' | 'S';

/** SSVC Supplier decision outcomes */
export type SsvcDecision = 'Defer' | 'Scheduled' | 'Out-of-Cycle' | 'Immediate';

/** Parsed SSVC vector components */
export interface SsvcVectorComponents {
  exploitation: SsvcExploitation;
  utility: SsvcUtility;
  technicalImpact: SsvcTechnicalImpact;
  publicSafetyImpact: SsvcPublicSafetyImpact;
  date: string;
}

/** A single value option for a decision point */
export interface SsvcDecisionPointValue {
  shortName: string;
  nameKey: string;
  descriptionKey: string;
}

/** A decision point with its values */
export interface SsvcDecisionPoint {
  key: string;
  nameKey: string;
  descriptionKey: string;
  values: SsvcDecisionPointValue[];
}

/**
 * SSVC Supplier decision tree lookup table.
 * Key format: "E:U:T:P" using short codes.
 * Source: https://certcc.github.io/SSVC/howto/supplier_tree/
 */
const SUPPLIER_TREE: Record<string, SsvcDecision> = {
  // Exploitation: None
  'N:L:P:M': 'Defer',
  'N:L:P:S': 'Scheduled',
  'N:L:T:M': 'Scheduled',
  'N:L:T:S': 'Out-of-Cycle',
  'N:E:P:M': 'Scheduled',
  'N:E:P:S': 'Out-of-Cycle',
  'N:E:T:M': 'Scheduled',
  'N:E:T:S': 'Out-of-Cycle',
  'N:S:P:M': 'Scheduled',
  'N:S:P:S': 'Out-of-Cycle',
  'N:S:T:M': 'Out-of-Cycle',
  'N:S:T:S': 'Out-of-Cycle',
  // Exploitation: Public PoC
  'P:L:P:M': 'Scheduled',
  'P:L:P:S': 'Out-of-Cycle',
  'P:L:T:M': 'Scheduled',
  'P:L:T:S': 'Immediate',
  'P:E:P:M': 'Scheduled',
  'P:E:P:S': 'Immediate',
  'P:E:T:M': 'Out-of-Cycle',
  'P:E:T:S': 'Immediate',
  'P:S:P:M': 'Out-of-Cycle',
  'P:S:P:S': 'Immediate',
  'P:S:T:M': 'Out-of-Cycle',
  'P:S:T:S': 'Immediate',
  // Exploitation: Active
  'A:L:P:M': 'Out-of-Cycle',
  'A:L:P:S': 'Immediate',
  'A:L:T:M': 'Out-of-Cycle',
  'A:L:T:S': 'Immediate',
  'A:E:P:M': 'Out-of-Cycle',
  'A:E:P:S': 'Immediate',
  'A:E:T:M': 'Out-of-Cycle',
  'A:E:T:S': 'Immediate',
  'A:S:P:M': 'Immediate',
  'A:S:P:S': 'Immediate',
  'A:S:T:M': 'Immediate',
  'A:S:T:S': 'Immediate',
};

const VALID_EXPLOITATION: readonly string[] = ['N', 'P', 'A'];
const VALID_UTILITY: readonly string[] = ['L', 'E', 'S'];
const VALID_TECHNICAL_IMPACT: readonly string[] = ['P', 'T'];
const VALID_PUBLIC_SAFETY: readonly string[] = ['M', 'S'];

/** Decision point metadata for UI rendering. All display strings are i18n keys. */
export const SSVC_DECISION_POINTS: SsvcDecisionPoint[] = [
  {
    key: 'exploitation',
    nameKey: 'ssvcCalculator.exploitation.name',
    descriptionKey: 'ssvcCalculator.exploitation.description',
    values: [
      {
        shortName: 'N',
        nameKey: 'ssvcCalculator.exploitation.none',
        descriptionKey: 'ssvcCalculator.exploitation.noneDesc',
      },
      {
        shortName: 'P',
        nameKey: 'ssvcCalculator.exploitation.poc',
        descriptionKey: 'ssvcCalculator.exploitation.pocDesc',
      },
      {
        shortName: 'A',
        nameKey: 'ssvcCalculator.exploitation.active',
        descriptionKey: 'ssvcCalculator.exploitation.activeDesc',
      },
    ],
  },
  {
    key: 'utility',
    nameKey: 'ssvcCalculator.utility.name',
    descriptionKey: 'ssvcCalculator.utility.description',
    values: [
      {
        shortName: 'L',
        nameKey: 'ssvcCalculator.utility.laborious',
        descriptionKey: 'ssvcCalculator.utility.laboriousDesc',
      },
      {
        shortName: 'E',
        nameKey: 'ssvcCalculator.utility.efficient',
        descriptionKey: 'ssvcCalculator.utility.efficientDesc',
      },
      {
        shortName: 'S',
        nameKey: 'ssvcCalculator.utility.superEffective',
        descriptionKey: 'ssvcCalculator.utility.superEffectiveDesc',
      },
    ],
  },
  {
    key: 'technicalImpact',
    nameKey: 'ssvcCalculator.technicalImpact.name',
    descriptionKey: 'ssvcCalculator.technicalImpact.description',
    values: [
      {
        shortName: 'P',
        nameKey: 'ssvcCalculator.technicalImpact.partial',
        descriptionKey: 'ssvcCalculator.technicalImpact.partialDesc',
      },
      {
        shortName: 'T',
        nameKey: 'ssvcCalculator.technicalImpact.total',
        descriptionKey: 'ssvcCalculator.technicalImpact.totalDesc',
      },
    ],
  },
  {
    key: 'publicSafetyImpact',
    nameKey: 'ssvcCalculator.publicSafetyImpact.name',
    descriptionKey: 'ssvcCalculator.publicSafetyImpact.description',
    values: [
      {
        shortName: 'M',
        nameKey: 'ssvcCalculator.publicSafetyImpact.minimal',
        descriptionKey: 'ssvcCalculator.publicSafetyImpact.minimalDesc',
      },
      {
        shortName: 'S',
        nameKey: 'ssvcCalculator.publicSafetyImpact.significant',
        descriptionKey: 'ssvcCalculator.publicSafetyImpact.significantDesc',
      },
    ],
  },
];

/**
 * Look up the Supplier decision for a given combination of decision point values.
 * Returns null if inputs are invalid.
 */
export function getSupplierDecision(
  exploitation: SsvcExploitation,
  utility: SsvcUtility,
  technicalImpact: SsvcTechnicalImpact,
  publicSafetyImpact: SsvcPublicSafetyImpact,
): SsvcDecision | null {
  const key = `${exploitation}:${utility}:${technicalImpact}:${publicSafetyImpact}`;
  return SUPPLIER_TREE[key] ?? null;
}

/**
 * Build an SSVC vector string from decision point values.
 * Uses today's date if none provided.
 */
export function buildSsvcVector(
  exploitation: SsvcExploitation,
  utility: SsvcUtility,
  technicalImpact: SsvcTechnicalImpact,
  publicSafetyImpact: SsvcPublicSafetyImpact,
  date?: string,
): string {
  const d = date ?? new Date().toISOString().slice(0, 10);
  return `SSVCv2/E:${exploitation}/U:${utility}/T:${technicalImpact}/P:${publicSafetyImpact}/${d}/`;
}

/**
 * Parse an SSVC vector string into its components.
 * Returns null if the string is invalid.
 */
export function parseSsvcVector(vector: string): SsvcVectorComponents | null {
  if (!vector || !vector.startsWith('SSVCv2/')) return null;

  const match = vector.match(
    /^SSVCv2\/E:([A-Z])\/U:([A-Z])\/T:([A-Z])\/P:([A-Z])\/(\d{4}-\d{2}-\d{2})\/$/,
  );
  if (!match) return null;

  const [, e, u, t, p, date] = match;
  if (!VALID_EXPLOITATION.includes(e)) return null;
  if (!VALID_UTILITY.includes(u)) return null;
  if (!VALID_TECHNICAL_IMPACT.includes(t)) return null;
  if (!VALID_PUBLIC_SAFETY.includes(p)) return null;

  return {
    exploitation: e as SsvcExploitation,
    utility: u as SsvcUtility,
    technicalImpact: t as SsvcTechnicalImpact,
    publicSafetyImpact: p as SsvcPublicSafetyImpact,
    date,
  };
}
